FROM apify/actor-node-playwright-chrome:20

COPY package.json ./

RUN npm --quiet set progress=false \
 && npm install --only=prod --no-optional \
 && npx playwright install chromium \
 && echo "Installed NPM packages:" \
 && (npm list --depth=0 || true) \
 && rm -r ~/.npm

COPY . ./
