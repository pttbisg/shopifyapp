FROM node:12-alpine

WORKDIR /usr/src/app

COPY . .

RUN npm install

RUN npm build

EXPOSE 8081

CMD npm run start