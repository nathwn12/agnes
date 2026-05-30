import { describe, expect, test } from 'bun:test';
import { FlowController, createFlowController } from './flowcontrol.js';

describe('FlowController', () => {
  test('setJump stores a target', () => {
    const fc = new FlowController();
    fc.setJump('retry');
    expect(fc.getJump()).toBe('retry');
  });

  test('consumeSignal returns stored signal', () => {
    const fc = new FlowController();
    fc.setJump('blocked', 'gate failed');
    const signal = fc.consumeSignal();
    expect(signal.jumpTo).toBe('blocked');
    expect(signal.reason).toBe('gate failed');
  });

  test('getJump returns the jump target', () => {
    const fc = new FlowController();
    fc.setJump('end');
    expect(fc.getJump()).toBe('end');
  });

  test('signal is consumed after first consumeSignal call', () => {
    const fc = new FlowController();
    fc.setJump('skip');
    fc.consumeSignal();
    expect(fc.getJump()).toBeNull();
  });

  test('setJump with undefined clears the jump target', () => {
    const fc = new FlowController();
    fc.setJump('retry');
    fc.setJump('end');
    expect(fc.getJump()).toBe('end');
  });

  test('skip signal can be set and consumed', () => {
    const fc = new FlowController();
    fc.setJump('skip');
    expect(fc.shouldSkip()).toBe(true);
    expect(fc.consumeSignal().jumpTo).toBe('skip');
    expect(fc.shouldSkip()).toBe(false);
  });

  test('blocked signal can be set and consumed', () => {
    const fc = new FlowController();
    fc.setJump('blocked');
    expect(fc.isBlocked()).toBe(true);
    expect(fc.getJump()).toBe('blocked');
    expect(fc.isBlocked()).toBe(false);
  });

  test('retry signal can be set and consumed', () => {
    const fc = new FlowController();
    fc.setJump('retry');
    expect(fc.shouldRetry()).toBe(true);
    expect(fc.getJump()).toBe('retry');
    expect(fc.shouldRetry()).toBe(false);
  });

  test('end signal can be set and consumed', () => {
    const fc = new FlowController();
    fc.setJump('end');
    expect(fc.getJump()).toBe('end');
    expect(fc.getJump()).toBeNull();
  });
});

describe('createFlowController', () => {
  test('returns a FlowController instance', () => {
    const fc = createFlowController();
    expect(fc).toBeInstanceOf(FlowController);
  });

  test('creates controller with initial target', () => {
    const fc = createFlowController('skip', 'no work to do');
    expect(fc.getJump()).toBe('skip');
  });

  test('creates controller without initial target', () => {
    const fc = createFlowController();
    expect(fc.getJump()).toBeNull();
  });
});
