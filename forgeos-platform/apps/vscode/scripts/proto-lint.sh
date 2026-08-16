#!/bin/bash
set -u

buf lint

if ! buf format -w --exit-code; then
  echo Proto files were formatted
fi

if grep -rn "rpc .*[A-Z][A-Z].*[(]" --include="*.proto" | grep -v "ForgeOS"; then
  # ForgeOS is the canonical product acronym; reject other repeated capitals.
  echo Error: Proto RPC names cannot contain repeated capital letters
  exit 1
fi
