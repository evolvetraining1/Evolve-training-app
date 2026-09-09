import { NativeModule, requireNativeModule } from 'expo';

declare class EvolveStepCounterModule extends NativeModule<{}> {
  getCurrentStepCountAsync(): Promise<number>;
}

export default requireNativeModule<EvolveStepCounterModule>('EvolveStepCounter');
