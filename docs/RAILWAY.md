# Move Opstack to Railway and keep your Mac data

This runs Opstack as one app service with one persistent volume. The volume holds all users, companies, locations, stock, orders, sales, rosters, messages, uploaded media and invoices. Existing usernames and passwords stay the same. PostgreSQL is not required for this file-based version.

## 1. Create the Railway service

1. Sign in at [railway.com](https://railway.com) and choose **New project → Deploy from GitHub repo**.
2. Connect GitHub if prompted and select **Ruebyn-code/super-duper-spork**, branch **main**. Keep the source/root directory at the repository root. Railway detects the included **Dockerfile**; no build or start command override is needed.
3. Add a **Volume**, attach it to this service and set its mount path to **`/data`**. Keep one replica. An initial deployment may fail until the volume and variables below are configured; that does not affect your Mac data.
4. In the service's **Variables**, add:

   | Variable | Value |
   | --- | --- |
   | `DATA_DIR` | `/data` |
   | `MIGRATION_MODE` | `1` |

5. Set the deployment **Healthcheck path** to **`/healthz`** in the service settings. Keep Railway's supplied `PORT`; do not set it manually.
6. Apply the changes and deploy. In **Settings → Networking → Public networking**, choose **Generate domain**. Copy the full HTTPS address, for example `https://opstack-production.up.railway.app`.
7. Add **`APP_ORIGIN`** to Variables, with your actual full HTTPS address (no `/login` or other path). Apply the change. Keep `MIGRATION_MODE=1` while copying data.

Opening the app now shows **“Opstack is moving data”**. That is intentional: all application access and changes are paused, while `/healthz` and Railway SSH remain available. Startup checks refuse to store your data outside the attached volume.

## 2. Make a private backup on your Mac

Use the app folder you currently run on your Mac, containing **your existing `data` folder**. A new GitHub download has no user data. Do not replace or delete that old folder.

1. Stop the Mac app with **Control+C** in its Terminal window. Keep it stopped until the move is finished so the backup does not miss changes.
2. Open Terminal in that existing app folder. If its name contains spaces, type `cd `, drag the folder from Finder into Terminal, then press Return.
3. Copy these lines together:

   ```sh
   opstack_backup="../opstack-data-$(date +%Y%m%d-%H%M%S).tar.gz"
   COPYFILE_DISABLE=1 tar -czf "$opstack_backup" -C data .
   shasum -a 256 "$opstack_backup"
   ```

Keep the resulting backup file in a private place. The last line prints its SHA-256 checksum; keep that Terminal window open for the next steps. If `tar` reports a missing data folder or any other error, stop here and locate the app folder containing your real data first.

The backup includes password hashes, private messages and saved sender credentials. **Do not commit it to GitHub, share it publicly, or upload it into a chat.**

## 3. Copy the backup to the Railway volume

Install Railway's CLI on your Mac in the same Terminal window:

```sh
npm install -g @railway/cli
railway login
railway link
```

Choose the new project, its production environment and the Opstack service when prompted. `railway login` opens Railway's sign-in flow; do not paste a token into the app or chat.

Upload the backup:

```sh
railway volume files upload "$opstack_backup" /opstack-migration.tar.gz
railway ssh
```

Choose the Opstack volume if prompted. The CLI may ask you to register a local SSH key the first time you connect. Once the SSH shell opens, the following commands run **on Railway**, not on your Mac.

## 4. Restore and check the existing data

Use a **new, empty volume** for this first import. Do not merge a backup over an already-used installation. Keep migration mode on throughout the restore.

Inside the Railway SSH shell, run:

```sh
sha256sum /data/opstack-migration.tar.gz
```

Its checksum must exactly match the checksum printed on your Mac. If it differs, do not extract it; upload the backup again and compare again.

Then run these commands one at a time, stopping if any fails:

```sh
tar --no-same-owner -xzf /data/opstack-migration.tar.gz -C /data
cd /app
node -e "require('./auth').createAuth('/data').configured().then(ok=>{if(ok===false)throw Error('No accounts found. Leave migration mode on.');console.log('Existing accounts found.');})"
```

You should see **Existing accounts found.** The contents must be directly inside `/data`, for example `/data/accounts.json`, rather than `/data/data/accounts.json`. Legacy `admin.json`/`users.json` accounts are also supported. Do not run account setup or reset existing passwords as part of the move.

After the checks pass, remove only the uploaded backup copy and leave SSH:

```sh
rm /data/opstack-migration.tar.gz
exit
```

Your private backup on the Mac is retained.

## 5. Open the hosted app

1. In Railway Variables, change **`MIGRATION_MODE`** to **`0`** and deploy the change. Keep `DATA_DIR=/data` and your `APP_ORIGIN` value.
2. Open the HTTPS domain and sign in with your existing username and password. Check your companies, locations, stock, past orders, sales and an invoice or uploaded file. On Railway, startup refuses to open normal app access if no accounts were imported.
3. In the service's **Backups** tab, make a backup and enable a suitable daily/weekly schedule. Keep your Mac backup until you have checked the hosted records.
4. Give staff the same HTTPS link. From now on, enter records in the hosted app so you do not create two separate sets of data. A phone browser can add the link to its Home Screen; App Store distribution is a separate step.

If you add your own domain later, follow Railway's displayed DNS instructions, wait for HTTPS to be ready, and update `APP_ORIGIN` to that domain. Use the chosen domain for sign-in. Updating the application code keeps the mounted volume; deleting the volume deletes its records. Rolling back code does not roll back data.

## Normal operation and troubleshooting

- This file-based app must stay on **one replica with one volume**. Sessions are in memory, so a redeploy signs users out. Volume deployments can have a short interruption while restarting.
- Leave **migration mode off** during normal use. For another data import, pause app access with migration mode before copying anything.
- **Invalid request origin**: `APP_ORIGIN` must exactly match the HTTPS scheme and hostname in the browser. Client-supplied proxy headers are not trusted to choose the sign-in origin.
- **Attach a Railway volume** / **DATA_DIR must be inside...**: attach the volume at `/data`, set `DATA_DIR=/data`, then redeploy. Do not remove the storage check.
- **No accounts found**: turn migration mode back on and check the imported files and their folder level. The new GitHub download alone does not contain your Mac records.
- To recover a genuinely forgotten Head Office password later, use `railway ssh`, then `cd /app` and `npm run admin:set`. This command uses the mounted data directory. It resets the named account; it is not needed for migration.
- Keep existing email/SMS provider settings with the data. Check a supplier's contact details before sending a real order; hosting does not create provider accounts or ordering-platform API access.

Official Railway references: [Dockerfiles](https://docs.railway.com/builds/dockerfiles), [Volumes](https://docs.railway.com/volumes), [Volume file commands](https://docs.railway.com/cli/volume), [SSH](https://docs.railway.com/cli/ssh), [Backups](https://docs.railway.com/volumes/backups).
