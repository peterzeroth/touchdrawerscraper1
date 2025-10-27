FROM apify/actor-node-puppeteer-chrome:20

COPY package.json ./

RUN npm --quiet set progress=false \
 && npm install --only=prod --no-optional \
 && echo "Installed NPM packages:" \
 && (npm list --depth=0 || true) \
 && rm -r ~/.npm

COPY . ./
