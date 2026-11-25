import 'fake-indexeddb/auto'
import { openDb, setCurrentDb } from '../src/db/db'

// Unit tests run against one plain (unencrypted) database; encryption has its own tests.
setCurrentDb(openDb('compound-test'))
