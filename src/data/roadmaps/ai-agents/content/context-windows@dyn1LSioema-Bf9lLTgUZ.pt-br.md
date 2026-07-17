# Janela de Contexto

A janela de contexto é a quantidade de texto que um modelo de linguagem grande pode ler de uma vez. É medida em tokens, que são partes de palavras. Se um modelo tiver uma janela de 4.000 tokens, ele só poderá "ler" até cerca de 3.000 palavras antes de ter que esquecer ou encurtar partes anteriores. Novos tokens empurram os antigos para fora, como uma janela deslizante sobre o texto. O tamanho da janela impõe limites rígidos para o comprimento de um prompt, histórico de chat ou documento. Uma janela pequena força você a manter as entradas curtas ou dividi-las, enquanto uma janela grande permite que o modelo siga histórias mais longas e retenha mais fatos. Escolher o tamanho da janela certo equilibra custo, velocidade e quanta informação o modelo pode ter em mente ao mesmo tempo.

Novas técnicas, como geração com recuperação aprimorada (RAG) e transformadores de contexto longo (por exemplo, Claude 3, Gemini 1.5), visam estender o contexto utilizável sem exceder diretamente os limites do modelo.

Visite os seguintes recursos para saber mais:

- [@article@What is a Context Window in AI?](https://www.ibm.com/think/topics/context-window)
- [@article@Scaling Language Models with Retrieval-Augmented Generation (RAG)](https://arxiv.org/abs/2005.11401)
- [@article@Long Context in Language Models - Anthropic's Claude 3](https://www.anthropic.com/news/claude-3-family)