import { BaseMode } from '../GameMode';
import { t } from '../../i18n';

/** Mod liber, fără reguli: doar mișcare. Folosit în Milestone 1 și ca încălzire. */
export class SandboxMode extends BaseMode {
  readonly id = 'sandbox';
  get name(): string {
    return t('sandbox.name');
  }
  get instructions(): string {
    return t('sandbox.instructions');
  }
  readonly maxDurationSec = null;
}
