alter table public.respostas_fornecedores
  add column if not exists data_validade date;

create or replace function public.salvar_precos_fornecedor(
  p_token text,
  p_respostas jsonb
)
returns table (
  saved_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  token_record record;
  response_item jsonb;
  item_id uuid;
  price numeric;
  expiration_date date;
  saved integer := 0;
begin
  if p_respostas is null or jsonb_typeof(p_respostas) <> 'array' then
    raise exception 'invalid_payload';
  end if;

  select t.cotacao_id, t.fornecedor_id, t.expires_at
    into token_record
  from tokens_acesso_fornecedores t
  join cotacoes_mestre cm on cm.id = t.cotacao_id
  join fornecedores f on f.id = t.fornecedor_id
  where t.token = p_token
    and f.farmacia_id = cm.farmacia_id
  limit 1;

  if token_record is null then
    raise exception 'invalid_token';
  end if;

  if token_record.expires_at is not null and token_record.expires_at < now() then
    raise exception 'expired_token';
  end if;

  for response_item in select * from jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb))
  loop
    if jsonb_typeof(response_item) <> 'object' then
      raise exception 'invalid_payload';
    end if;

    begin
      item_id := (response_item->>'item_cotacao_id')::uuid;
      price := nullif(response_item->>'preco_ofertado', '')::numeric;
      expiration_date := nullif(response_item->>'data_validade', '')::date;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'invalid_payload';
    end;

    if item_id is null or price is null or price <= 0 then
      continue;
    end if;

    if not exists (
      select 1
      from itens_cotacao ic
      where ic.id = item_id
        and ic.cotacao_id = token_record.cotacao_id
    ) then
      raise exception 'invalid_item';
    end if;

    insert into respostas_fornecedores (
      item_cotacao_id,
      fornecedor_id,
      preco_ofertado,
      data_validade,
      estoque_disponivel
    )
    values (
      item_id,
      token_record.fornecedor_id,
      price,
      expiration_date,
      100
    )
    on conflict (item_cotacao_id, fornecedor_id)
    do update set
      preco_ofertado = excluded.preco_ofertado,
      data_validade = excluded.data_validade,
      estoque_disponivel = excluded.estoque_disponivel;

    saved := saved + 1;
  end loop;

  return query select saved;
end;
$$;

revoke all on function public.salvar_precos_fornecedor(text, jsonb) from public;
grant execute on function public.salvar_precos_fornecedor(text, jsonb) to anon, authenticated;

drop view if exists public.vw_fornecedor_ratings cascade;
drop view if exists public.vw_comparativo_cotacao cascade;

create view public.vw_comparativo_cotacao as
select
    ic.cotacao_id,
    ic.id as item_cotacao_id,
    p.nome as produto_nome,
    p.ean as produto_ean,
    ic.quantidade_desejada as quantidade,
    rf.fornecedor_id,
    f.nome as fornecedor_nome,
    rf.preco_ofertado,
    rf.data_validade,
    rf.estoque_disponivel,
    case
        when rf.preco_ofertado = min(rf.preco_ofertado) over (partition by ic.id) then true
        else false
    end as e_vencedor
from public.itens_cotacao ic
join public.produtos p on p.id = ic.produto_id
left join public.respostas_fornecedores rf on rf.item_cotacao_id = ic.id
left join public.fornecedores f on f.id = rf.fornecedor_id;

create view public.vw_fornecedor_ratings as
with wins as (
  select
    fornecedor_id,
    count(*) as total_ganhas
  from public.vw_comparativo_cotacao
  where e_vencedor = true
  group by fornecedor_id
),
total_resp as (
  select
    fornecedor_id,
    count(distinct item_cotacao_id) as total_respostas
  from public.respostas_fornecedores
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
from public.fornecedores f
left join wins w on w.fornecedor_id = f.id
left join total_resp tr on tr.fornecedor_id = f.id;
