create or replace function public.listar_itens_fornecedor(p_token text)
returns table (
  item_cotacao_id uuid,
  produto_id uuid,
  produto_nome text,
  produto_ean text,
  produto_custo_medio numeric,
  quantidade_desejada integer,
  preco_ofertado numeric,
  data_validade date
)
language sql
security definer
set search_path = public
as $$
  select
    ic.id as item_cotacao_id,
    p.id as produto_id,
    p.nome as produto_nome,
    p.ean as produto_ean,
    p.custo_medio as produto_custo_medio,
    ic.quantidade_desejada,
    rf.preco_ofertado,
    rf.data_validade
  from tokens_acesso_fornecedores t
  join cotacoes_mestre cm on cm.id = t.cotacao_id
  join fornecedores f on f.id = t.fornecedor_id
  join itens_cotacao ic on ic.cotacao_id = t.cotacao_id
  join produtos p on p.id = ic.produto_id
  left join respostas_fornecedores rf
    on rf.item_cotacao_id = ic.id
    and rf.fornecedor_id = t.fornecedor_id
  where t.token = p_token
    and (t.expires_at is null or t.expires_at > now())
    and f.farmacia_id = cm.farmacia_id
  order by p.nome;
$$;

revoke all on function public.listar_itens_fornecedor(text) from public;
grant execute on function public.listar_itens_fornecedor(text) to anon, authenticated;
