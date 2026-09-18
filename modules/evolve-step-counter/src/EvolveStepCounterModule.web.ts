import { registerWebModule, NativeModule } from 'expo';

// EvolveStepCounterModule is not available on the web platform.
class EvolveStepCounterModule extends NativeModule<{}> {}

export default registerWebModule(EvolveStepCounterModule, 'EvolveStepCounterModule');
