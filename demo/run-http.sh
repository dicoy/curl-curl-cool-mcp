#!/usr/bin/env bash
export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
npm --prefix "$PROJECT_ROOT" run demo:http
