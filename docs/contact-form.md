# Contact form

The home page form (`#invite`) posts JSON to `/api/contact`, handled by `worker/index.ts`. The Worker:

1. checks the fields (rules shared with the form in `src/lib/contact.ts`), a honeypot, and the Turnstile token;
2. stores the submission in D1 (`mtlnog-contact`, binding `DB`);
3. posts it to a private Slack channel through the incoming webhook.

A cron trigger (every 5 minutes) retries Slack deliveries that failed. After 24 hours it gives up on a submission, marks it failed and posts a warning (id and topic only) to Slack. Delivered submissions are deleted after 30 days; failed ones stay until someone handles them.

Topics are `slack`, `sponsorship`, `speaking`, `venue` and `general`. Links like `/en/?type=venue#invite` open the form with that topic selected (`contactHref()` in `src/i18n/routes.ts`).

Known blind spot: if the webhook itself breaks (revoked, or the channel archived), the failure warning can't reach Slack either. Submissions are still safe in D1; the undelivered query in the README shows them.

The design spec and implementation plan are in `docs/superpowers/`.

## Setting it up from scratch

These steps were done once, for the first deploy of the Worker. They are kept here in case the Cloudflare or Slack side has to be rebuilt. The deploy fails while `database_id` in `wrangler.jsonc` is `"local"`.

1. Create the private Slack channel, then the Slack app from `docs/slack-app-manifest.yml` (instructions at the top of the file), and install it to that channel to get the incoming webhook URL.
2. `npx wrangler d1 create mtlnog-contact`, then put the printed `database_id` in `wrangler.jsonc` and commit it.
3. `npx wrangler d1 migrations apply DB --remote`
4. `npx wrangler secret put TURNSTILE_SECRET` and `npx wrangler secret put SLACK_WEBHOOK_URL`
5. Check the Turnstile widget's allowed hostnames include `mtlnog.org`, and set `PUBLIC_TURNSTILE_SITEKEY` in the Workers Builds settings.
6. Merge and push, then send one message per topic on the live site and check each lands in Slack.
7. Remove the old `PUBLIC_FORMSPREE_ID` and `PUBLIC_HCAPTCHA_SITEKEY` build variables.
