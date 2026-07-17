# Agentes DAG

Um agente DAG (Grafos Acíclicos Dirigidos) é composto por partes pequenas chamadas nós, que formam um grafo unidirecional sem loops. Cada nó executa uma tarefa e passa o resultado para o próximo. Como não há ciclos, os dados sempre se movem em frente, tornando os fluxos de trabalho fáceis de seguir e depurar. Nós independentes podem ser executados em paralelo, acelerando tarefas. Se um nó falhar, você pode rastrear e corrigir essa parte sem afetar o restante. Agentes DAG são ideais para tarefas como limpeza de dados, raciocínio em etapas ou fluxos de trabalho onde a reversão não é necessária.

Visite os seguintes recursos para obter mais informações:

- [@official@Airflow: Documentação sobre Grafos Acíclicos Dirigidos](https://airflow.apache.org/docs/apache-airflow/stable/concepts/dags.html)
- [@article@O que são DAGs em Sistemas de IA?](https://www.restack.io/p/version-control-for-ai-answer-what-is-dag-in-ai-cat-ai)
- [@video@DAGs Explicados Simplesmente](https://www.youtube.com/watch?v=1Yh5S-S6wsI)
