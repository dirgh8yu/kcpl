# Backups and alerts

What protects KCPL's records, and who is told when something breaks. The app
side is in the code; the parts below marked **one-time setup** are done once
in Google Cloud by someone with Owner on the Firebase project. No key file is
needed for any of it.

## What protects what

| Layer | Covers | Kept | Use it when |
| --- | --- | --- | --- |
| Point-in-time recovery | Every Firestore document, to the minute | 7 days | Someone deleted or overwrote records today or this week |
| Scheduled Firestore backups | The whole database, daily | 14 weeks | Something went wrong that nobody noticed for a while |
| KCPL's daily export (`/api/internal/backup`) | The whole database, into KCPL's own bucket | As long as you keep it | Invoices, credit notes and payments needed years later |
| Storage soft delete | Uploaded documents, PODs and receipts | 7 days by default | A file was deleted by mistake |

Firestore backups don't include uploaded files. Those stay in the Firebase
Storage bucket and are covered by soft delete below.

## One-time setup

Run these in Cloud Shell (console.cloud.google.com, the `>_` button), with
`PROJECT_ID` replaced by the Firebase project id.

### 1. Point-in-time recovery and scheduled backups

```sh
gcloud config set project PROJECT_ID
gcloud firestore databases update --database='(default)' --enable-pitr
gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14w
```

Both can also be switched on in the console: Firestore → Disaster recovery.

### 2. A bucket for KCPL's own exports

```sh
gcloud storage buckets create gs://PROJECT_ID-kcpl-backups \
  --location=LOCATION --uniform-bucket-level-access --public-access-prevention
```

`LOCATION` is the Firestore database's location (Firestore → Databases shows it); use it in every command below. To keep old exports cheaply,
move them to colder storage as they age (save as `lifecycle.json`):

```json
{ "rule": [
  { "action": { "type": "SetStorageClass", "storageClass": "COLDLINE" }, "condition": { "age": 30 } },
  { "action": { "type": "SetStorageClass", "storageClass": "ARCHIVE" }, "condition": { "age": 365 } }
] }
```

```sh
gcloud storage buckets update gs://PROJECT_ID-kcpl-backups --lifecycle-file=lifecycle.json
```

Ask KCPL's accountant how many years financial records must be kept before
adding a delete rule.

### 3. Let the app start exports

The app runs as the App Hosting backend's service account (shown in the
Firebase console under App Hosting → the backend → Settings). Give it the
export role:

```sh
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:APP_HOSTING_SERVICE_ACCOUNT \
  --role=roles/datastore.importExportAdmin
```

Google writes the export files itself, as the Firestore service agent. With the
bucket in the same project this works as is; a bucket in another project needs
`roles/storage.admin` granted to
`service-PROJECT_NUMBER@gcp-sa-firestore.iam.gserviceaccount.com` on it.

### 4. Settings on the App Hosting backend

None of these are secrets. Set them in the Firebase console (App Hosting → the
backend → Settings → Environment) or in `apphosting.yaml`:

| Variable | Value | What it does |
| --- | --- | --- |
| `KCPL_BACKUP_BUCKET` | `gs://PROJECT_ID-kcpl-backups` | Where the daily export goes |
| `KCPL_ALERT_EMAIL` | One address, or several with commas | Who hears about server errors, failed backups and failed automation runs |
| `KCPL_COMPANY_PAN` | KCPL's nine-digit PAN | Printed on every invoice issued from then on |

Alerts are sent with the same SendGrid settings as other email
(`SENDGRID_API_KEY`, `KCPL_EMAIL_FROM`).

### 5. Run the export every night

The backup route uses the same bearer secret as the automation run. Create the
job with the secret read from Secret Manager, so it isn't typed or kept in
shell history (use the secret's name in your project):

```sh
gcloud scheduler jobs create http kcpl-firestore-backup \
  --location=LOCATION --schedule="15 2 * * *" --time-zone="Asia/Kathmandu" \
  --uri="https://APP_HOSTING_URL/api/internal/backup" --http-method=POST \
  --headers="Authorization=Bearer $(gcloud secrets versions access latest --secret=KCPL_AUTOMATION_SECRET)" \
  --attempt-deadline=60s
```

`APP_HOSTING_URL` is the backend's own URL from the App Hosting page.

Each run first checks how the previous night's export ended, and emails an
alert if it failed. Management → Runtime readiness shows when the last backup
started and warns once it is more than 36 hours old.

### 6. Know when the whole app is down

The app can't email anyone if it isn't running. In Cloud Monitoring → Uptime
checks, add an HTTPS check on `https://APP_HOSTING_URL/api/version` every 5
minutes, with an alert policy that emails the same people as
`KCPL_ALERT_EMAIL`.

### 7. Uploaded files

Check that soft delete is on for the Firebase Storage bucket (it is on by
default for buckets created since 2024):

```sh
gcloud storage buckets describe gs://STORAGE_BUCKET --format="value(soft_delete_policy)"
gcloud storage buckets update gs://STORAGE_BUCKET --soft-delete-duration=30d
```

## What the app sends

- **Server errors.** Any page or API route that fails on the server emails the
  route and the error message. Never headers, cookies or the query string.
  The same route stays quiet for 6 hours after an email.
- **Backups.** An export that couldn't start, or that started and then failed.
- **Automation.** A scheduled run that couldn't reach the database or stopped
  with an error.

Local runs and the QA preview never send alerts.

## Restoring

Always restore into a **new** database, check it, then copy back what is
needed. Never import over the live database.

```sh
# From a scheduled backup
gcloud firestore backups list --location=LOCATION
gcloud firestore databases restore --source-backup=BACKUP_NAME --destination-database=kcpl-restore

# From KCPL's own export
gcloud firestore databases create --database=kcpl-restore --location=LOCATION
gcloud firestore import gs://PROJECT_ID-kcpl-backups/firestore/EXPORT_FOLDER --database=kcpl-restore

# A moment in the last 7 days (point-in-time recovery)
gcloud firestore databases clone --source-database='projects/PROJECT_ID/databases/(default)' \
  --snapshot-time=2026-10-08T03:00:00Z --destination-database=kcpl-restore
```

Practise a restore into `kcpl-restore` once a quarter, and delete it after.
