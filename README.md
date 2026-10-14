# B3 · PRO — Agregador de Carteira

Dashboard web para acompanhar uma carteira de investimentos da B3 (ações, FIIs, Fiagros e ETFs): patrimônio, resultado, variação do dia, alocação e dividendos estimados, com cotações da [brapi.dev](https://brapi.dev).

<!-- Adicione um print do app em docs/preview.png e descomente a linha abaixo -->
<!-- ![Prévia do B3 · PRO](./docs/preview.png) -->

## Funcionalidades

- **Cadastro de ativos com cotação automática**: digite o ticker e o app busca preço, nome e variação do dia. O tipo do ativo (Ação, FII, Fiagro, ETF) é identificado automaticamente.
- **Preço médio de verdade**: comprar de novo um ativo que já está na carteira soma as cotas e recalcula o preço médio ponderado, como numa corretora.
- **Indicadores**: patrimônio total, resultado em R$ e %, variação do dia e dividendos mensais estimados (com yield on cost).
- **Gráficos** (Chart.js): alocação por ativo e custo × valor atual.
- **Tabela de posições** ordenável por qualquer coluna, com ajuste de quantidade e remoção com opção de desfazer.
- **Faixa de cotações** com a variação do dia dos seus próprios ativos.
- **Status do pregão** (aberto/fechado) calculado pelo horário de Brasília.
- **Exportar e importar** a carteira em JSON.
- **Persistência local** com `localStorage`, sem cadastro nem back-end.
- **Responsivo** e **acessível**: navegação por teclado, foco visível, modal com `Esc` e foco preso, rótulos ARIA e respeito a `prefers-reduced-motion`.

## Tecnologias

- HTML5 semântico
- CSS3 com design tokens (custom properties), Grid e Flexbox, sem frameworks
- JavaScript (ES Modules), sem bibliotecas além do [Chart.js](https://www.chartjs.org/)
- API REST [brapi.dev](https://brapi.dev) para cotações da B3

## Arquitetura

```
siteFinancas/
├── index.html
├── css/
│   └── styles.css        # tokens, layout, componentes e responsividade
├── js/
│   ├── main.js           # ponto de entrada: estado, eventos e orquestração
│   ├── config.js         # constantes, cores e configuração da API
│   ├── env.example.js    # modelo do env.js (token da brapi, fora do git)
│   ├── api.js            # cliente da brapi (fila de requisições + cache)
│   ├── portfolio.js      # regras de negócio puras (cálculos, preço médio, ordenação)
│   ├── storage.js        # leitura/gravação segura no localStorage
│   ├── render.js         # renderização do DOM
│   ├── charts.js         # gráficos com Chart.js
│   ├── modal.js          # formulário de cadastro e validação
│   └── utils.js          # formatação pt-BR, escape de HTML, debounce
└── assets/
    └── favicon.svg
```

Decisões técnicas:

- **Regras de negócio separadas da interface**: `portfolio.js` não toca no DOM, o que facilita testar e evoluir os cálculos.
- **Respeito aos limites da API**: o plano gratuito da brapi aceita 1 ticker por requisição e 1 requisição simultânea. Por isso, as chamadas passam por uma fila e as cotações ficam em cache por 15 minutos, o que poupa a cota mensal.
- **Busca com debounce e `AbortController`**: enquanto o usuário digita, só a última busca vale e as anteriores são canceladas.
- **Sem dados inventados**: se a cotação não puder ser obtida, o app avisa e pede o preço manualmente, em vez de exibir um valor fictício.
- **Segurança**: todo texto vindo do usuário ou da API é escapado antes de ir para o HTML.

## Como rodar

O projeto usa ES Modules, então precisa ser servido por HTTP (abrir o `index.html` direto pelo arquivo não funciona).

```bash
# opção 1: extensão Live Server do VS Code → "Open with Live Server"

# opção 2: Node
npx serve .

# opção 3: Python
python3 -m http.server 5500
```

Depois é só acessar `http://localhost:5500` (ou a porta indicada).

### Token da brapi

O token não fica no código versionado. Para configurar o seu:

1. Crie uma conta gratuita em [brapi.dev](https://brapi.dev/dashboard) e gere um token.
2. Copie `js/env.example.js` para `js/env.js`.
3. Cole o token em `BRAPI_TOKEN`.

O `js/env.js` está no `.gitignore`, então o token não vai para o GitHub. Sem ele, o app funciona normalmente, mas a brapi só retorna os tickers de teste (PETR4, VALE3, ITUB4 e MGLU3).

> Por ser um projeto só de front-end, o token ainda é enviado pelo navegador nas requisições. Para escondê-lo por completo seria preciso um back-end ou uma função serverless fazendo o papel de proxy.

## Limitações

- As cotações do plano gratuito da brapi têm cerca de 30 minutos de atraso.
- O dividend yield é uma **estimativa** informada no cadastro (com um valor sugerido por tipo de ativo), não um dado oficial.
- O status do pregão não considera feriados.
- Os dados ficam só no navegador. Use **Exportar** para fazer backup ou levar a carteira para outro dispositivo.

## Próximos passos

- [ ] Histórico de compras e vendas por ativo
- [ ] Proventos reais via API
- [ ] Gráfico de evolução do patrimônio
- [ ] Testes automatizados das regras de `portfolio.js`

## Autor

**Kauã Lima**, desenvolvedor front-end. [GitHub](https://github.com/KauMiLima)

## Licença

[MIT](./LICENSE)

---

*Este projeto tem fins de estudo e não constitui recomendação de investimento.*
