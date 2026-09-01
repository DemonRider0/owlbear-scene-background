# Fundo da Cena

Fundo da Cena é uma extensão para Owlbear Rodeo que permite ao GM escolher uma cor personalizada para o fundo ao redor da cena. A cor é compartilhada automaticamente com todos os participantes da sala.

## Recursos

- Cor de fundo controlada pelo GM.
- Sincronização automática com todos os participantes da sala.
- Configuração persistente por sala.
- Mesma cor de fundo ao trocar de cena.
- Restauração do fundo padrão do Owlbear.
- Seletor de cor e campo hexadecimal editável no formato `#RRGGBB`.
- Sem backend, análise de uso, rastreamento ou integrações com serviços externos.

## Como funciona

A extensão armazena uma pequena configuração com apenas `enabled` e `color` nos metadados da sala (Room Metadata). Somente o GM pode atualizá-la.

Os Effects do Owlbear são locais (Local Only), portanto os itens de Effect não são sincronizados. Cada cliente lê a configuração compartilhada e cria seu próprio Effect local do tipo `VIEWPORT`. A extensão sincroniza a configuração, não os itens de Effect.

## Instalação

1. Na área de gerenciamento de extensões do Owlbear Rodeo, adicione uma extensão personalizada usando esta URL de manifest:
   [https://demonrider0.github.io/owlbear-scene-background/manifest.json](https://demonrider0.github.io/owlbear-scene-background/manifest.json)
2. Habilite Fundo da Cena na sala.
3. Abra a extensão e escolha a cor desejada. Somente o GM pode aplicar uma cor ou restaurar o padrão do Owlbear.

Todos os participantes da sala recebem automaticamente a mesma configuração. Os jogadores não precisam instalar Node.js, executar um servidor local ou instalar a extensão pela Extension Store.

## Desenvolvimento

Instale as dependências e inicie o servidor local de desenvolvimento:

```sh
npm install
npm run dev
```

Execute as verificações e gere o build de produção:

```sh
npm run typecheck
npm run lint
npm run build
npm run validate:build
```

O build é gerado em `dist/` e não é versionado.

## Notas técnicas

- Fundo da Cena utiliza a Effect API do Owlbear Rodeo.
- A documentação oficial do Owlbear Rodeo classifica atualmente a Effect API como Experimental.
- Effects são locais (Local Only).
- Cada cliente cria seu próprio Effect local a partir da configuração compartilhada da sala.
- Mudanças futuras nessa API experimental podem exigir adaptações na extensão.

## Privacidade

A extensão não envia dados de configuração para servidores externos. Não há análise de uso nem rastreamento. Somente `enabled` e `color` são armazenados como uma pequena configuração nos metadados da sala do Owlbear Rodeo.

## Autoria

Desenvolvido por DemonRider.
