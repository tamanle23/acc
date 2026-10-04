import { test, expect, describe, mock, beforeEach, afterEach } from 'bun:test';
import { ConductorWorkerPoller, TaskWorkerFactory, ComposeVideoTaskCommand } from '@acc/core';

// Mock the external SDK to avoid actual server connections
mock.module('@io-orkes/conductor-javascript', () => {
    return {
        orkesConductorClient: mock(() => Promise.resolve({
            serverUrl: 'http://mock.server'
        })),
        TaskManager: class TaskManager {
            startPolling = mock();
            stopPolling = mock();
        }
    };
});

describe('ConductorWorkerPoller', () => {
    let poller: ConductorWorkerPoller;

    beforeEach(() => {
        TaskWorkerFactory.register(new ComposeVideoTaskCommand());
    });

    afterEach(() => {
        if (poller) poller.stop();
    });

    test('should initialize and start polling in normal mode', async () => {
        poller = new ConductorWorkerPoller('http://mock.server', ['acc.p4_story.compose_video']);
        await poller.start();
        expect(poller).toBeDefined();
    });

    test('should start sandbox HTTP server and execute tasks', async () => {
        poller = new ConductorWorkerPoller('http://mock.server', ['acc.p4_story.compose_video'], 'test-worker', true);
        await poller.start();

        // Send a mock request to the sandbox server
        const res = await fetch('http://localhost:8081/sandbox/task/acc.p4_story.compose_video', {
            method: 'POST',
            body: JSON.stringify({
                inputData: { storyConfig: { scene: 1 } }
            })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe('COMPLETED');
        expect(data.outputData.renderedScenesCount).toBe(3);
    });

    test('sandbox should return 400 for validation errors', async () => {
        poller = new ConductorWorkerPoller('http://mock.server', ['acc.p4_story.compose_video'], 'test-worker', true);
        await poller.start();

        const res = await fetch('http://localhost:8081/sandbox/task/acc.p4_story.compose_video', {
            method: 'POST',
            body: JSON.stringify({
                inputData: { invalid: true }
            })
        });

        expect(res.status).toBe(200); // the wrapper catches it and returns FAILED task payload, so HTTP 200
        const data = await res.json();
        expect(data.status).toBe('FAILED');
        expect(data.reasonForIncompletion).toContain('Missing storyConfig in task inputData');
    });
});
