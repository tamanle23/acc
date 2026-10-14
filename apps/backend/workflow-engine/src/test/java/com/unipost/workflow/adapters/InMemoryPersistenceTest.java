package com.unipost.workflow.adapters;

import com.unipost.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.unipost.workflow.ports.PersistencePort;

class InMemoryPersistenceTest extends PersistenceContractTest {

    @Override
    protected PersistencePort createPersistencePort() {
        return new InMemoryPersistenceAdapter();
    }
}
