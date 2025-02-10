#!/bin/bash

# Ask for commit message
echo "Enter commit message: "
read commit_message

# Execute the Git commands
git add .
git commit -m "$commit_message"
git push origin main
git push heroku main
heroku logs --tail --app heroku-whatsapp-bot
