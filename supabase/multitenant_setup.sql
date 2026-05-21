-- 1. Criar Tabela de Farmácias (Tenants)
create table if not exists farmacias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text unique,
  plano text default 'FREE' check (plano in ('FREE', 'PRO', 'ENTERPRISE')),
  created_at timestamp with time zone default now()
);

-- 2. Criar Tabela de Perfis (Vinculando Auth a Farmácia)
create table if not exists perfis (
  id uuid primary key references auth.users on delete cascade,
  farmacia_id uuid references farmacias(id) on delete set null,
  role text default 'user' check (role in ('admin', 'user')),
  nome_completo text,
  created_at timestamp with time zone default now()
);

-- 3. Adicionar farmacia_id às tabelas existentes
alter table fornecedores add column if not exists farmacia_id uuid references farmacias(id);
alter table produtos add column if not exists farmacia_id uuid references farmacias(id);
alter table cotacoes_mestre add column if not exists farmacia_id uuid references farmacias(id);

-- 4. Criar uma farmácia padrão para migrar dados existentes (se houver)
do $$
declare
  default_farmacia_id uuid;
begin
  insert into farmacias (nome, cnpj) values ('Farmácia Matriz', '00000000000000') 
  on conflict (cnpj) do nothing 
  returning id into default_farmacia_id;

  if default_farmacia_id is null then
    select id into default_farmacia_id from farmacias where cnpj = '00000000000000' limit 1;
  end if;

  update fornecedores set farmacia_id = default_farmacia_id where farmacia_id is null;
  update produtos set farmacia_id = default_farmacia_id where farmacia_id is null;
  update cotacoes_mestre set farmacia_id = default_farmacia_id where farmacia_id is null;
end $$;

-- 5. Tornar farmacia_id obrigatório para novos registros
alter table fornecedores alter column farmacia_id set not null;
alter table produtos alter column farmacia_id set not null;
alter table cotacoes_mestre alter column farmacia_id set not null;

-- 6. Configurar RLS Multi-tenant
alter table farmacias enable row level security;
alter table perfis enable row level security;

-- Políticas para a tabela de Farmácias
create policy "Permitir inserção para usuários logados" on farmacias
  for insert with check (auth.role() = 'authenticated');

create policy "Usuários veem apenas sua própria farmácia" on farmacias
  for select using (
    id = (select farmacia_id from perfis where id = auth.uid())
  );

-- Remover políticas antigas
drop policy if exists "Public Access" on fornecedores;
drop policy if exists "Public Access" on produtos;
drop policy if exists "Public Access" on cotacoes_mestre;
drop policy if exists "Public Access" on itens_cotacao;
drop policy if exists "Public Access" on tokens_acesso_fornecedores;
drop policy if exists "Public Access" on respostas_fornecedores;

-- Novas Políticas Baseadas no Perfil do Usuário
create policy "Tenant Access" on fornecedores
  for all using (farmacia_id = (select farmacia_id from perfis where id = auth.uid()));

create policy "Tenant Access" on produtos
  for all using (farmacia_id = (select farmacia_id from perfis where id = auth.uid()));

create policy "Tenant Access" on cotacoes_mestre
  for all using (farmacia_id = (select farmacia_id from perfis where id = auth.uid()));

-- Itens e Respostas seguem a cotação mestre
create policy "Tenant Access" on itens_cotacao
  for all using (
    exists (
      select 1 from cotacoes_mestre 
      where id = itens_cotacao.cotacao_id 
      and farmacia_id = (select farmacia_id from perfis where id = auth.uid())
    )
  );

create policy "Tenant Access" on respostas_fornecedores
  for all using (
    exists (
      select 1 from itens_cotacao ic
      join cotacoes_mestre cm on cm.id = ic.cotacao_id
      where ic.id = respostas_fornecedores.item_cotacao_id
      and cm.farmacia_id = (select farmacia_id from perfis where id = auth.uid())
    )
  );

-- Tokens de fornecedor devem sempre pertencer ao mesmo tenant da cotacao/fornecedor
create policy "Tenant Access" on tokens_acesso_fornecedores
  for all using (
    exists (
      select 1
      from cotacoes_mestre cm
      join fornecedores f on f.id = tokens_acesso_fornecedores.fornecedor_id
      where cm.id = tokens_acesso_fornecedores.cotacao_id
      and cm.farmacia_id = (select farmacia_id from perfis where id = auth.uid())
      and f.farmacia_id = cm.farmacia_id
    )
  )
  with check (
    exists (
      select 1
      from cotacoes_mestre cm
      join fornecedores f on f.id = tokens_acesso_fornecedores.fornecedor_id
      where cm.id = tokens_acesso_fornecedores.cotacao_id
      and cm.farmacia_id = (select farmacia_id from perfis where id = auth.uid())
      and f.farmacia_id = cm.farmacia_id
    )
  );

-- Permitir que usuários vejam seu próprio perfil
create policy "Own Profile" on perfis for all using (auth.uid() = id);

-- 7. Função para Criar Perfil Automaticamente no SignUp
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfis (id, nome_completo)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
