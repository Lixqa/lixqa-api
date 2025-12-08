import type { RouteDefinition } from '../lib/typings';

const route: RouteDefinition = {
  settings: {
    unauthed: true, // Allow unauthenticated access
  },
  GET: async (api) => {
    const routes = api.server.routes.items.map((route) => {
      return {
        path: route.path,
        settings: route.settingsFor(),
        methods: route.methods,
        schema: route.schema?.file,
      };
    });

    api.send(routes);
  },
};

export default route;
