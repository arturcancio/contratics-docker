# Security Spec - Contratics TI

Este documento detalha o plano de segurança e integridade de acesso ao banco de dados Firestore para o sistema Contratics.

## 1. Data Invariants (Invariantes de Dados)

1. **Privilégios por Perfil:**
   - `Visualizador`: Pode apenas ler (`get` e `list`) em qualquer coleção. Nunca pode gravar (`create`, `update`, `delete`).
   - `GECTI`, `Fiscal`, `Auditor`: Podem realizar alterações em registros para os quais possuam permissões de fiscalização/gestão de processos, observando que atualizações devem respeitar a integridade estrutural e os tipos dos campos.
2. **Imutabilidade de Chaves Primárias:**
   - Campos como `id`, `createdAt`, `Num_DFD`, `SEI_Processo`, e `Num_Contrato` são imutáveis após serem criados para evitar perdas de rastreabilidade do processo SEI e governança do PCA.
3. **Autenticação Obrigatória:**
   - Nenhum usuário não autenticado no Firebase Auth (`request.auth == null`) tem qualquer permissão de leitura ou escrita em qualquer parte do banco.

## 2. The "Dirty Dozen" Malicious Payloads

Abaixo estão definidos 12 cenários de payloads ou abusos que tentam quebrar as leis de Identidade, Integridade e Status:

1. **Escalação de Perfil Próprio:** Usuário comum tenta realizar update no próprio perfil para definir `role` como 'GECTI' ou 'Auditor'.
2. **Injeção de IDs Gigantes (ID Poisoning):** Usuário tenta criar um DFD usando um identificador document ID com mais de 1024 caracteres como ataque de Denial of Wallet.
3. **Status Inválido para DFD:** Escrever um DFD com status nulo ou com valor que não pertença ao enum: `["Concluído", "Iniciado", "Não iniciado"]`.
4. **Modificação de Histórico sem Autenticação:** Modificar notas históricas anonimamente.
5. **Acréscimo de Valor Estimado Negativo no DFD:** Enviar um payload de criação de DFD com `Valor_Estimado: -5000000.00`.
6. **Bypass de Validade de Processo SEI no Planejamento:** Modificar o número do processo SEI (`SEI_Processo`) no Planejamento para desvincular seu registro oficial.
7. **Remover Contratos Sendo Visualizador:** Usuário logado com perfil de `Visualizador` tenta deletar um contrato ativo.
8. **Injeção de Campo Fantasma (Shadow Update):** Tentar fazer update em um Fornecedor injetando um campo não documentado `isVerified_Ghost: true`.
9. **Payload de Tarefa Incompleto:** Tentar criar uma `TarefaPlanejamento` sem preencher a propriedade `Status_Tarefa`.
10. **Data de Vigência Inválida no Contrato:** Enviar dados do contrato sem formato de dados consistente ou com tamanho absurdo na `Vigencia_Inicio`.
11. **Criar Pagamento Sem Valor:** Tentar emitir um registro de `Pagamento` omitindo o atributo `Valor`.
12. **Burlar Integridade Financeira de Aditivo:** Injetar valor que altere o contrato pai para valores negativos.

## 3. Test Runner (Roteador de Testes do Firestore)

Um esqueleto para validação de segurança seria:

```typescript
import { assertSucceeds, assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';

describe('Firestore Security Rules', () => {
  it('Should reject reading settings if unauthenticated', async () => {
    // Test logical verification
  });
  it('Should reject visualizer users from writing to contracts', async () => {
    // Assert visualizer fails write
  });
});
```
