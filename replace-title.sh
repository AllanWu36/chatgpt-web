#!/bin/sh

SITE_TITLE="Alwasynew Fast-gpt"

sed -i -E "s/<title>([^<]*)<\/title>/<title>${SITE_TITLE}<\/title>/g" /app/public/index.html