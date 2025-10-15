import { Collection } from '@discordjs/collection';
import { API } from '../structures/api';
import { Random } from '../helpers/random';

type RatelimitItem = {
  client: string;
  route: string;
  count: number;
  start: number;
  end: number;
  limited: boolean;
};

export class RatelimitManager {
  items: Collection<string, RatelimitItem> = new Collection();

  constructor() {
    setInterval(() => this.cleanup(), 100);
  }

  check(api: API<any, any, any, any, any, any>) {
    if (!api.route) return false;

    const settings = api.route.ratelimitsFor(api.method);

    const clientIdentifier = this.getClientIdentifier(api);
    const routeIdentifier = this.getRouteIdentifier(api);

    let item = this.items.find(
      (item) =>
        item.client == clientIdentifier && item.route == routeIdentifier,
    );
    if (!item) {
      item = this.items
        .set(Random.uuid(), {
          client: clientIdentifier,
          route: routeIdentifier,
          count: 0,
          start: Date.now(),
          end: Date.now() + settings.remember,
          limited: false,
        })
        .last()!;
    }

    if (item.count >= settings.limit) {
      if (item.limited) {
        if (settings.strict) item.end = Date.now() + settings.punishment;
      } else {
        item.limited = true;
        item.end =
          Date.now() + Math.max(settings.punishment, settings.remember);
      }
    }

    api.header('X-Ratelimit-Limit', settings.limit.toString());
    api.header(
      'X-Ratelimit-Remaining',
      (settings.limit - item.count).toString(),
    );
    api.header('X-Ratelimit-Reset', item.end.toString());
    api.header('X-Ratelimit-Reset-After', (item.end - Date.now()).toString());
    api.header('X-Ratelimit-Scope', settings.scope);

    return item.limited;
  }

  getClientIdentifier(api: API<any, any, any, any, any, any>) {
    if (!api.route) return `RANDOM:${Random.uuid()}`;

    const settings = api.route.ratelimitsFor(api.method);

    switch (settings.scope) {
      case 'ip':
        return api.ip;
      case 'authentication':
        return api.authentication ? api.authentication.id.toString() : api.ip;
      case 'global':
        return 'global';
      default:
        return api.ip;
    }
  }

  getRouteIdentifier(api: API<any, any, any, any, any, any>) {
    if (!api.route) return `RANDOM:${Random.uuid()}`;

    const settings = api.route.ratelimitsFor(api.method);

    let result = api.method;

    switch (settings.type) {
      case 'endpoint':
        result += api.route.path;
        break;
      case 'parameter':
        result += api.rawPath;
        break;
    }

    return result;
  }

  cleanup() {
    this.items = this.items.filter((item) => item.end > Date.now());
  }

  increase(api: API<any, any, any, any, any, any>) {
    if (!api.route) return;

    const clientIdentifier = this.getClientIdentifier(api);
    const routeIdentifier = this.getRouteIdentifier(api);

    const item = this.items.find(
      (item) =>
        item.client == clientIdentifier && item.route == routeIdentifier,
    );
    if (item && api.route.ratelimitsFor(api.method).limit > item.count) {
      item.count++;
    }
  }
}
