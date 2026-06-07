let _yoloMode = false;

export function setYoloMode(enabled: boolean): void {
  _yoloMode = enabled;
}

export function isYoloMode(): boolean {
  return _yoloMode;
}
