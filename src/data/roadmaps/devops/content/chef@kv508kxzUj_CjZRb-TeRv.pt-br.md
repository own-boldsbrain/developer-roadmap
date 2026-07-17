# Chef

Lançado em 2009, o Chef (agora conhecido como Progress Chef) é uma das primeiras ferramentas de gerenciamento de configuração a ganhar popularidade. As "Receitas" do Chef são escritas em Ruby, em um estilo predominantemente declarativo. O Chef requer que um cliente seja instalado no servidor que está sendo gerenciado. Este cliente consulta o Chef-Server regularmente para determinar qual deve ser sua configuração. Também está disponível o Chef-Solo, uma versão do Chef que permite a provisionamento de um único nó executando o chef localmente. Um dos princípios fundamentais do design de receitas do Chef é o conceito de idempotência. Todas as receitas do Chef devem poder ser executadas várias vezes e produzir o mesmo resultado - isso é especialmente necessário nos casos em que o modelo cliente/servidor listado acima é usado. Este padrão de gerenciamento de configuração teve grande influência em ferramentas declarativas futuras, como Terraform e Cloud Formation.

Visite os seguintes recursos para saber mais:

- [Site oficial do Chef](https://www.chef.io/products/chef-infra)
- [Tutorial do Chef](https://www.tutorialspoint.com/chef/index.htm)
- [Vídeo sobre chef/chef](https://github.com/chef/chef)
- [Feed Explore posts sobre Chef](https://app.daily.dev/tags/chef?ref=roadmapsh)
