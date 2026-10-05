const { validateProductionEnvironment } = require('../lib/production-env.cjs');
const { errors, warnings } = validateProductionEnvironment();

if (errors.length) {
  console.error('Production environment check failed:');
  for (const error of errors) console.error(`- ${error}`);
  for (const warning of warnings) console.warn(`- Warning: ${warning}`);
  process.exitCode = 1;
} else {
  console.log('Production environment check passed. Secret values were not displayed.');
  for (const warning of warnings) console.warn(`- Warning: ${warning}`);
}
