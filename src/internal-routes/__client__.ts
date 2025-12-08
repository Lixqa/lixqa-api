import type { RouteDefinition } from '../lib/typings';

const route: RouteDefinition = {
  settings: {
    unauthed: true, // Allow unauthenticated access
  },
  GET: async (api) => {
    api.send('test');
  },
};

export default route;
