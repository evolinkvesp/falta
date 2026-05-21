drop policy if exists "Tenant Access" on tokens_acesso_fornecedores;

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
