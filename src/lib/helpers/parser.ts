export function filePathToRoutePath(filePath: string) {
  // Convert file path to route pattern
  // e.g., "src/routes/users/[userId]/_.ts" -> "/users/:userId"
  // e.g., "src/routes/(group)/data/_.ts" -> "/data" (group folders are ignored)

  // Remove the base routes directory and file extension
  let routePath = filePath
    .replace(/^.*[/\\]routes[/\\]/, '') // Remove everything up to /routes/
    .replace(/\.schema.ts$/, '')
    .replace(/\.ts$/, ''); // Remove .ts extension

  // Convert backslashes to forward slashes (Windows compatibility)
  routePath = routePath.replace(/\\/g, '/');

  // Remove route groups (folders wrapped in parentheses)
  // e.g., "(group)/data" -> "data", "(admin)/users/(nested)" -> "users"
  routePath = routePath
    .split('/')
    .filter((segment) => !segment.match(/^\([^)]+\)$/))
    .join('/');

  // Handle index routes (_.ts files)
  if (routePath === '_') {
    // Root index route
    return '/';
  } else if (routePath.endsWith('/_')) {
    // Directory index route - remove the /_
    routePath = routePath.slice(0, -2);
  }

  // Convert [param] to :param for URL parameters
  routePath = routePath.replace(/\[([^\]]+)\]/g, ':$1');

  // Ensure route starts with /
  if (!routePath.startsWith('/')) {
    routePath = '/' + routePath;
  }

  // Handle empty route (should be root)
  if (routePath === '/') {
    return '/';
  }

  return routePath;
}
