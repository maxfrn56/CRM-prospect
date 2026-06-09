#!/bin/sh
set -e

# Prisma exige DATABASE_URL au generate, même sans connexion réelle.
export DATABASE_URL="${DATABASE_URL:-postgresql://placeholder:placeholder@localhost:5432/placeholder}"

npx prisma generate
