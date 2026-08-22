import { AvailableItemsPanel } from './features/items/AvailableItemsPanel';
import { SelectedItemsPanel } from './features/selected-items/SelectedItemsPanel';

function App() {
  return (
    <main className="app">
      <h1 className="app__title">Million Items</h1>

      <div className="app__panels">
        <AvailableItemsPanel />
        <SelectedItemsPanel />
      </div>
    </main>
  );
}

export default App;
