# Deploy no Railway

## 1. Criar projeto no Railway

1. Acesse railway.app → New Project → Deploy from GitHub Repo
2. Selecione o repositório do WevyFlow
3. Clique em **"Add service" → "GitHub Repo"**
4. Em **Root Directory**, defina: `browser-service`
5. Railway detecta o Dockerfile automaticamente

## 2. Variáveis de ambiente (Railway → Settings → Variables)

| Variável | Valor | Obrigatório |
|---|---|---|
| `PORT` | `3000` | Sim |
| `SERVICE_SECRET` | qualquer string aleatória | Recomendado |

## 3. Após o deploy

Copie a URL gerada pelo Railway (ex: `https://wevyflow-browser.up.railway.app`)

## 4. Configurar no WevyFlow (.env.local)

```env
BROWSER_SERVICE_URL=https://wevyflow-browser.up.railway.app
BROWSER_SERVICE_SECRET=o_mesmo_valor_que_SERVICE_SECRET_no_railway
```

## Como funciona

- Quando `BROWSER_SERVICE_URL` está configurado → usa o browser service (Playwright, full JS render)
- Quando não está configurado → fallback automático para thum.io + fetch estático
- Sem quebra: o WevyFlow funciona normalmente durante o deploy do serviço
