# Cloudflare Lab deployment

Эта ветка предназначена только для отдельной Cloudflare-версии продукта и не должна заменять `main` или текущую Webflow-публикацию.

Рекомендуемая настройка Cloudflare Pages:

- Repository: `alekseykosyrev-blip/repair-project-hub`
- Production branch: `cloudflare-lab`
- Framework preset: None
- Build command: `exit 0`
- Build output directory: `.`
- Root directory: repository root

После первого деплоя Cloudflare выдаст отдельный адрес `*.pages.dev`. Все последующие изменения ветки `cloudflare-lab` будут публиковаться туда независимо от Webflow.

Важно: браузерные данные Webflow не переносятся между доменами автоматически. Для переноса используйте встроенную резервную копию `.repairhub` и восстановление в Cloudflare-версии.
