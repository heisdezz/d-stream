import { create, useDeviceContext, useAppColorScheme } from 'twrnc';

// Initialize tw configured with project tailwind.config.js
const tw = create(require('../../tailwind.config.js'));

export { tw, useDeviceContext, useAppColorScheme };
export default tw;
