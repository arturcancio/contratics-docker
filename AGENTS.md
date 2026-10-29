# Diretrizes do Projeto Contratics

## Regra Fundamental sobre Dados
- **PROIBIDO INCLUIR DADOS FICTÍCIOS OU DE EXEMPLO**: Nunca gerar, inferir, pré-popular ou incluir processos, DFDs, contratos, itens ou históricos fictícios/mock/exemplo.
- **DADOS REAIS EXCLUSIVOS**: Trabalhar estritamente com os dados reais, documentos e processos expressamente informados pelo usuário.
- **NENHUMA INSERÇÃO NÃO SOLICITADA**: Cadastrar e manipular única e exclusivamente os registros e campos solicitados pelo usuário.

## Regra de Deploy na VPS
- **SEMPRE INCLUIR OS COMANDOS DA VPS**: Ao finalizar qualquer alteração no código e enviá-la ao GitHub (`git push origin main`), sempre apresentar ao final da resposta os comandos para atualizar a aplicação na VPS.
