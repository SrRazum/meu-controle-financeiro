# Meu Controle Financeiro — V1.13

Aplicativo web/PWA de controle financeiro com armazenamento local e sincronização via Supabase.

## Estado da versão

**V1.13 — produção / aprovada para uso doméstico.**

A versão de produção foi validada funcionalmente em computador e celular. Foram verificados, entre outros pontos, proteção/desbloqueio, persistência local, sincronização, isolamento entre contas, sincronização entre ambientes da mesma conta, entradas, saídas, resultado, pagos/recebidos, pendentes, vencimentos, saldo, recorrência sem duplicação e data local.

## Repositório e produção

- Repositório: `SrRazum/meu-controle-financeiro`
- Branch de produção: `v1.13-producao`
- Commit de referência da V1.13: `f36fda52dcdc369daf7840e84387d750a0e01f27`
- A publicação atual deve ser tratada como a versão de uso.

## Arquivos principais

- `index.html` — aplicação
- `config.js` — configuração pública do Supabase
- `sw.js` — service worker/cache
- `manifest.json` — configuração do PWA
- `logo.png` — identidade visual

## Segurança

O `config.js` contém somente a URL pública do projeto Supabase e a chave **Publishable**.

**Nunca adicionar ao repositório chaves `sb_secret_...`, service-role keys, senhas ou outras credenciais privadas.**

## Dados e sincronização

O aplicativo utiliza armazenamento local e sincronização com o Supabase. A mesma conta pode utilizar ambientes/dispositivos diferentes e sincronizar seus dados. Contas diferentes permanecem isoladas.

Antes de considerar uma alteração estrutural importante, preservar a versão de produção atualmente aprovada.

## Data e horário

A V1.13 utiliza a data local do dispositivo para os lançamentos, evitando que a conversão UTC antecipe o dia seguinte para usuários no horário de Brasília.

## Procedimento básico de publicação

1. Trabalhar em uma branch de desenvolvimento/revisão.
2. Testar sem alterar a base de produção.
3. Revisar a versão exibida e a data local.
4. Publicar somente após validação.
5. Confirmar o carregamento da V1.13 no ambiente de produção.
6. Fazer uma verificação rápida de login, dados e sincronização.

## Recuperação

Em caso de problema após uma alteração, preservar o estado conhecido como estável antes de qualquer nova modificação. A branch `v1.13-producao` e o commit de referência acima devem ser tratados como ponto de restauração da versão aprovada.

## Checklist de entrega — V1.13

- [x] V1.12 — base segura preservada
- [x] Filtro de período nos Relatórios
- [x] Recuperação/unificação de dados
- [x] Auditoria da sincronização / isolamento entre contas
- [x] Atualização/cache do PWA validado
- [x] Teste em computador
- [x] Teste em celular
- [x] Teste integrado final
- [x] V1.13 criada e publicada para uso
- [x] Pré-entrega concluída, sem referências de TESTE na versão de uso

## Regra para futuras versões

Não modificar diretamente a V1.13 de produção para testes experimentais. Criar uma nova versão/branch, preservar a V1.13 como referência estável e só promover a nova versão depois de repetir a validação necessária.
