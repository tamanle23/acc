import { test, expect, describe, mock, beforeEach } from 'bun:test';
import { ConductorWorkerPoller, TaskWorkerFactory, ComposeVideoTaskCommand } from '@acc/core';
import * as conductorClient from '@io-orkes/conductor-javascript';

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
    beforeEach(() => {
        TaskWorkerFactory.register(new ComposeVideoTaskCommand());
    });

    test('should initialize and start polling', async () => {
        const poller = new ConductorWorkerPoller('http://mock.server', ['acc.p4_story.compose_video']);
        await poller.start();

        // Since we mocked TaskManager, we can't directly inspect its inner calls easily without exporting it,
        // but we can ensure start does not throw and internal initialization finishes.
        expect(poller).toBeDefined();

        // It's safe to stop right away
        expect(() => poller.stop()).not.toThrow();
    });
});
