-- Setup Extensions
create extension if not exists pgcrypto;

-- Setup Tables
create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null, -- Nome da Distribuidora
  nome_representante text,
  whatsapp text,
  email text,
  cnpj text,
  prazo_entrega_horas integer default 24,
  status text default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamp with time zone default now()
);

-- Ensure existing tables have new columns
alter table fornecedores add column if not exists nome_representante text;
alter table fornecedores add column if not exists whatsapp text;
alter table fornecedores add column if not exists email text;
alter table fornecedores add column if not exists cnpj text;
alter table fornecedores add column if not exists prazo_entrega_horas integer default 24;
alter table fornecedores add column if not exists status text default 'ativo';
alter table fornecedores add column if not exists cidade text;
alter table fornecedores add column if not exists estado text;

create table if not exists categorias_fornecedor (
  id uuid primary key default gen_random_uuid(),
  nome text unique not null
);

create table if not exists fornecedor_categorias_rel (
  fornecedor_id uuid references fornecedores(id) on delete cascade,
  categoria_id uuid references categorias_fornecedor(id) on delete cascade,
  primary key (fornecedor_id, categoria_id)
);

-- Seed default categories
insert into categorias_fornecedor (nome) values ('Distribuidora Plena'), ('Genéricos'), ('Higiene e Perfumaria')
on conflict (nome) do nothing;

create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  ean text unique,
  nome text not null,
  categoria text,
  custo_medio decimal(10,2) default 0,
  created_at timestamp with time zone default now()
);

-- Fix for existing tables missing the column
alter table produtos add column if not exists custo_medio decimal(10,2) default 0;

create table if not exists cotacoes_mestre (
  id uuid primary key default gen_random_uuid(),
  data_criacao timestamp with time zone default now(),
  status text default 'AGUARDANDO_FORNECEDORES' check (status in ('AGUARDANDO_FORNECEDORES', 'EM_ANALISE', 'FINALIZADA'))
);

create table if not exists itens_cotacao (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid references cotacoes_mestre(id) on delete cascade,
  produto_id uuid references produtos(id) on delete cascade,
  quantidade_desejada integer not null default 1,
  constraint qtd_positiva check (quantidade_desejada > 0)
);

-- Access tokens for each supplier per quote
create table if not exists tokens_acesso_fornecedores (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid references cotacoes_mestre(id) on delete cascade,
  fornecedor_id uuid references fornecedores(id) on delete cascade,
  token text unique default encode(gen_random_bytes(16), 'hex'),
  expires_at timestamp with time zone default (now() + interval '24 hours'),
  unique(cotacao_id, fornecedor_id)
);

create table if not exists respostas_fornecedores (
  id uuid primary key default gen_random_uuid(),
  item_cotacao_id uuid references itens_cotacao(id) on delete cascade,
  fornecedor_id uuid references fornecedores(id) on delete cascade,
  preco_ofertado decimal(10,2),
  estoque_disponivel integer,
  created_at timestamp with time zone default now(),
  unique(item_cotacao_id, fornecedor_id),
  constraint preco_positivo check (preco_ofertado >= 0)
);

-- Indexes for Performance
create index if not exists idx_produtos_ean on produtos(ean);
create index if not exists idx_itens_cotacao_master on itens_cotacao(cotacao_id);
create index if not exists idx_tokens_token on tokens_acesso_fornecedores(token);
create index if not exists idx_respostas_item on respostas_fornecedores(item_cotacao_id);

-- View for comparison (Price Engine)
drop view if exists vw_comparativo_cotacao cascade;
create or replace view vw_comparativo_cotacao as
select 
    ic.cotacao_id,
    ic.id as item_cotacao_id,
    p.nome as produto_nome,
    p.ean as produto_ean,
    p.custo_medio,
    ic.quantidade_desejada,
    rf.fornecedor_id,
    f.nome as fornecedor_nome,
    rf.preco_ofertado,
    rf.estoque_disponivel,
    case 
        when rf.preco_ofertado = min(rf.preco_ofertado) over (partition by ic.id) then true 
        else false 
    end as e_vencedor
from itens_cotacao ic
join produtos p on p.id = ic.produto_id
left join respostas_fornecedores rf on rf.item_cotacao_id = ic.id
left join fornecedores f on f.id = rf.fornecedor_id;

-- View for supplier performance
drop view if exists vw_fornecedor_ratings cascade;
create or replace view vw_fornecedor_ratings as
with wins as (
  select 
    fornecedor_id, 
    count(*) as total_ganhas
  from vw_comparativo_cotacao
  where e_vencedor = true
  group by fornecedor_id
),
total_resp as (
  select 
    fornecedor_id, 
    count(distinct item_cotacao_id) as total_respostas
  from respostas_fornecedores
  group by fornecedor_id
)
select 
  f.*,
  coalesce(w.total_ganhas, 0) as total_ganhas,
  coalesce(tr.total_respostas, 0) as total_respostas,
  case 
    when coalesce(tr.total_respostas, 0) = 0 then 0
    else (coalesce(w.total_ganhas, 0)::decimal / tr.total_respostas) * 5 
  end as rating_score
from fornecedores f
left join wins w on w.fornecedor_id = f.id
left join total_resp tr on tr.fornecedor_id = f.id;

-- Enable RLS and set public policies
alter table fornecedores enable row level security;
alter table produtos enable row level security;
alter table cotacoes_mestre enable row level security;
alter table itens_cotacao enable row level security;
alter table tokens_acesso_fornecedores enable row level security;
alter table respostas_fornecedores enable row level security;

-- Drop existing to avoid conflicts
drop policy if exists "Public Access" on fornecedores;
drop policy if exists "Public Access" on produtos;
drop policy if exists "Public Access" on cotacoes_mestre;
drop policy if exists "Public Access" on itens_cotacao;
drop policy if exists "Public Access" on tokens_acesso_fornecedores;
drop policy if exists "Public Access" on respostas_fornecedores;

-- Create broad policies for Alice (Private tool context)
create policy "Public Access" on fornecedores for all using (true) with check (true);
create policy "Public Access" on produtos for all using (true) with check (true);
create policy "Public Access" on cotacoes_mestre for all using (true) with check (true);
create policy "Public Access" on itens_cotacao for all using (true) with check (true);
create policy "Public Access" on tokens_acesso_fornecedores for all using (true) with check (true);
create policy "Public Access" on respostas_fornecedores for all using (true) with check (true);
