# Supabase public database CA

Public certificate (not a private key) downloaded over HTTPS from https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt.

Official verification guide: https://supabase.com/docs/guides/platform/ssl-enforcement

SHA-256 of the PEM file: 700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7.

The database-readiness script adds this CA only for Supabase hostnames, while retaining certificate and hostname verification. It does not disable TLS verification or change system trust.
