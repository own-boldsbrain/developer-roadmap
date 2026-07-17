# Uso de Ferramentas pela Anthropic

O Uso de Ferramentas da Anthropic permite conectar um modelo Claude a funções de software reais, para que o agente possa realizar tarefas úteis por conta própria. Você fornece ao Claude uma lista de ferramentas, cada uma com um nome, uma breve descrição e um esquema JSON estrito que mostra os campos de entrada permitidos. Durante uma conversa, você envia o texto do usuário mais esta lista de ferramentas. O Claude decide se uma ferramenta deve ser executada, escolhe uma e retorna um bloco JSON que corresponde ao esquema. Seu código lê o JSON, chama a função correspondente e envia o resultado de volta para o Claude para a próxima etapa. Este ciclo se repete até que não sejam mais necessárias chamadas de ferramentas. Esquemas claros, conjuntos pequenos de campos e exemplos úteis garantem que as chamadas sejam precisas. Ao manter o modelo responsável por escolher as ferramentas, enquanto seu código controla as ações reais, você obtém flexibilidade e segurança.

Visite os seguintes recursos para saber mais:

- [@official@Uso de Ferramentas da Anthropic](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview)
