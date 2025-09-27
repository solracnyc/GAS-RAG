# React 19.1.0 Concurrent Features Production Implementation

## CONCURRENT_APIS

### USE_TRANSITION_PATTERN
```javascript
'use client';

import { useState, useTransition } from 'react';

function SearchResults({ searchTerm }) {
  const results = searchTerm
    ? Array.from({length: 1000}, (_, i) => `Result ${i} for "${searchTerm}"`)
    : [];

  return (
    <div>
      {results.slice(0, 50).map((result, index) => (
        <div key={index} className="p-2 border-b">
          {result}
        </div>
      ))}
    </div>
  );
}

export default function SearchComponent() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSearch = (e) => {
    const value = e.target.value;
    setQuery(value);

    startTransition(() => {
      setSearchTerm(value);
    });
  };

  return (
    <div className="p-4">
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder="Search..."
        className="border p-2 w-full mb-4"
      />

      {isPending && (
        <div className="text-blue-500 mb-2">Searching...</div>
      )}

      <SearchResults searchTerm={searchTerm} />
    </div>
  );
}
```

### USE_DEFERRED_VALUE_PATTERN
```javascript
'use client';

import { useState, useDeferredValue, memo } from 'react';

const ExpensiveList = memo(function ExpensiveList({ filter }) {
  const items = Array.from({length: 10000}, (_, i) => `Item ${i}`);
  const filteredItems = items.filter(item =>
    item.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="mt-4">
      <div className="text-sm text-gray-600 mb-2">
        Showing {filteredItems.length} items
      </div>
      <div className="max-h-96 overflow-y-auto">
        {filteredItems.slice(0, 100).map((item, index) => (
          <div key={index} className="p-2 border-b hover:bg-gray-50">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
});

export default function DeferredSearch() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <div className="p-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter items..."
        className="border p-2 w-full mb-2"
      />

      <div style={{
        opacity: isStale ? 0.5 : 1,
        transition: 'opacity 0.2s ease-in-out'
      }}>
        <ExpensiveList filter={deferredQuery} />
      </div>

      {isStale && (
        <div className="text-sm text-blue-500 mt-2">
          Updating results...
        </div>
      )}
    </div>
  );
}
```

### START_TRANSITION_VS_USE_TRANSITION
```javascript
[
  {
    "use_when": "Inside React components when you need to track pending state for UI feedback",
    "codeblock": `
import { useTransition } from 'react';

function TabButton({ onClick, children, isActive }) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await onClick();
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={isActive ? 'active' : 'inactive'}
    >
      {isPending ? 'Loading...' : children}
    </button>
  );
}`
  },
  {
    "use_when": "Outside React components or in utility functions/libraries where you don't need pending state tracking",
    "codeblock": `
import { startTransition } from 'react';

class DataStore {
  constructor(setState) {
    this.setState = setState;
  }

  updateData(newData) {
    startTransition(() => {
      this.setState(prevData => ({
        ...prevData,
        ...newData
      }));
    });
  }
}

function MyComponent() {
  const [data, setData] = useState({});
  const dataStore = new DataStore(setData);

  return (
    <div>
      <button onClick={() => dataStore.updateData({timestamp: Date.now()})}>
        Update Data
      </button>
    </div>
  );
}`
  },
  {
    "use_when": "When you have access to state setter but no component context, such as in event handlers outside JSX",
    "codeblock": `
import { startTransition } from 'react';

function setupGlobalHandlers(setAppState) {
  window.addEventListener('online', () => {
    startTransition(() => {
      setAppState(prev => ({ ...prev, isOnline: true }));
    });
  });

  window.addEventListener('offline', () => {
    startTransition(() => {
      setAppState(prev => ({ ...prev, isOnline: false }));
    });
  });
}

export default function App() {
  const [appState, setAppState] = useState({ isOnline: navigator.onLine });

  useEffect(() => {
    setupGlobalHandlers(setAppState);
  }, []);

  return (
    <div>
      Status: {appState.isOnline ? 'Online' : 'Offline'}
    </div>
  );
}`
  }
]
```

### IS_STABLE_FOR_PRODUCTION
```javascript
true
```

## SUSPENSE_CHANGES

### SUSPENSE_BOUNDARY_PATTERN
```jsx
import { Suspense, use } from 'react';

async function fetchUserData(userId) {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}

function UserProfile({ userPromise }) {
  const user = use(userPromise);

  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

export default function Dashboard({ userId }) {
  const userPromise = fetchUserData(userId);

  return (
    <div className="dashboard">
      <Suspense fallback={<div className="skeleton-loader">Loading dashboard...</div>}>
        <header>
          <h1>Dashboard</h1>
        </header>

        <Suspense fallback={<div className="profile-skeleton">Loading profile...</div>}>
          <UserProfile userPromise={userPromise} />
        </Suspense>

        <Suspense fallback={<div className="notifications-skeleton">Loading notifications...</div>}>
          <NotificationList />
        </Suspense>
      </Suspense>
    </div>
  );
}
```

### ERROR_BOUNDARY_REQUIRED
```javascript
false
```

### STREAMING_SSR_PATTERN
```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';
import { UserProfile, Analytics } from './components';

export default function DashboardPage({
  params
}: {
  params: { userId: string }
}) {
  const userPromise = fetchUserData(params.userId);
  const analyticsPromise = fetchAnalytics(params.userId);

  return (
    <div className="dashboard-layout">
      <nav className="dashboard-nav">
        <h1>Dashboard</h1>
      </nav>

      <main>
        <Suspense fallback={<UserProfileSkeleton />}>
          <UserProfile userPromise={userPromise} />
        </Suspense>

        <Suspense fallback={<AnalyticsSkeleton />}>
          <Analytics analyticsPromise={analyticsPromise} />
        </Suspense>
      </main>
    </div>
  );
}

async function fetchUserData(userId: string) {
  const response = await fetch(`${process.env.API_URL}/users/${userId}`, {
    cache: 'force-cache'
  });
  return response.json();
}

// app/dashboard/components.tsx
'use client';

import { use } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

export function UserProfile({
  userPromise
}: {
  userPromise: Promise<User>
}) {
  const user = use(userPromise);

  return (
    <section className="user-profile">
      <img src={user.avatar} alt={`${user.name}'s avatar`} />
      <div>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
      </div>
    </section>
  );
}
```

### FALLBACK_BEST_PRACTICES
```jsx
import { Suspense } from 'react';

function UserProfileSkeleton() {
  return (
    <div className="user-profile-skeleton" aria-label="Loading user profile">
      <div className="skeleton-avatar" />
      <div className="skeleton-text-container">
        <div className="skeleton-name" />
        <div className="skeleton-email" />
      </div>
    </div>
  );
}

function ProductPage({ productId }) {
  const productPromise = fetchProduct(productId);
  const reviewsPromise = fetchReviews(productId);
  const recommendationsPromise = fetchRecommendations(productId);

  return (
    <div className="product-page">
      <Suspense fallback={<ProductDetailsSkeleton />}>
        <ProductDetails productPromise={productPromise} />
      </Suspense>

      <div className="secondary-content">
        <Suspense fallback={<ReviewsSkeleton />}>
          <Reviews reviewsPromise={reviewsPromise} />
        </Suspense>

        <Suspense fallback={<RecommendationsSkeleton />}>
          <Recommendations recommendationsPromise={recommendationsPromise} />
        </Suspense>
      </div>
    </div>
  );
}

function AccessibleLoadingSkeleton() {
  return (
    <div
      className="loading-skeleton"
      role="status"
      aria-live="polite"
      aria-label="Content is loading"
    >
      <div className="skeleton-content">
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
        <div className="skeleton-line" />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
```

## SERVER_COMPONENTS

### ASYNC_COMPONENT_PATTERN
```javascript
// app/posts/[id]/page.tsx
import { Suspense } from 'react';
import { getPost, getComments } from '@/lib/data';

export default async function PostPage({ params }) {
  const { id } = await params;

  const post = await getPost(id);
  const commentsPromise = getComments(id);

  return (
    <main>
      <article>
        <h1>{post.title}</h1>
        <p>{post.content}</p>
      </article>

      <Suspense fallback={<div>Loading comments...</div>}>
        <CommentsList commentsPromise={commentsPromise} />
      </Suspense>
    </main>
  );
}

// Client component
"use client";
import { use } from 'react';

function CommentsList({ commentsPromise }) {
  const comments = use(commentsPromise);

  return (
    <section>
      {comments.map(comment => (
        <div key={comment.id}>
          <p>{comment.text}</p>
        </div>
      ))}
    </section>
  );
}
```

### DATA_FETCHING_PATTERN
```javascript
// utils/data.ts
import { cache } from 'react';
import 'server-only';

export const getItem = cache(async (id) => {
  const res = await fetch(`/api/items/${id}`);
  return res.json();
});

export const preload = (id) => {
  void getItem(id);
};

// app/items/[id]/page.tsx
import { preload, getItem } from '@/utils/data';

export default async function ItemPage({ params }) {
  const { id } = await params;

  preload(id);

  const isAvailable = await checkAvailability();

  if (!isAvailable) return <div>Item not available</div>;

  const item = await getItem(id);

  return <ItemDisplay item={item} />;
}

// app/actions.ts
"use server";
import { revalidatePath } from 'next/cache';

export async function createPost(formData) {
  const title = formData.get('title');
  const content = formData.get('content');

  await db.posts.create({ title, content });

  revalidatePath('/posts');
}

// app/posts/new/page.tsx
export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="Title" required />
      <textarea name="content" placeholder="Content" required />
      <button type="submit">Create Post</button>
    </form>
  );
}
```

### CLIENT_BOUNDARY_RULES
```javascript
[
  "Place 'use client' at the very beginning of a file, above all imports and code (comments are allowed above)",
  "Use single or double quotes for 'use client' directive, not backticks",
  "Server Components are the default - no 'use server' directive needed for Server Components",
  "Once a file is marked with 'use client', all its imports and child components become Client Components",
  "You only need 'use client' at the entry point - don't add it to every client component file",
  "A component usage is a Client Component if: (a) defined in a module with 'use client', or (b) imported/called within a Client Component",
  "Client Components cannot be imported into Server Components for rendering - only as props/children",
  "Props passed from Server to Client Components must be serializable (JSON-serializable values only)",
  "Functions are NOT serializable props except Server Functions marked with 'use server'",
  "Date objects, plain objects, primitives, arrays, and Promises are serializable",
  "Classes, symbols, and complex objects are NOT serializable for cross-boundary props",
  "Event handlers (onClick, onChange) can only be defined in Client Components",
  "React hooks (useState, useEffect, useContext) can only be used in Client Components",
  "Browser APIs (window, document, localStorage) can only be accessed in Client Components",
  "Server Components can read files, access databases, and use server-only APIs",
  "Use the 'children' pattern to pass Server Components as children to Client Components",
  "Context providers must be Client Components but can wrap Server Components",
  "Third-party libraries using client features need 'use client' or must be wrapped in Client Components",
  "For optimal performance, add 'use client' to specific interactive components, not large UI sections",
  "Server Components can pass JSX elements as props to Client Components",
  "The 'use client' directive creates a module dependency boundary, not a render tree boundary",
  "Single modules can run on both server (when imported from server) and client (when imported from client)",
  "Error boundaries must be Client Components as they use class components or error handling hooks",
  "Custom hooks that use browser APIs or React state must be used only in Client Components",
  "Use 'server-only' package to prevent accidental import of server-only code in Client Components",
  "Use 'client-only' package to mark modules that should never run on the server",
  "Async Server Components use async/await syntax and automatically suspend rendering until promises resolve",
  "Client Components cannot be async - use the 'use' hook to consume promises from Server Components",
  "Streaming works across server/client boundaries with Suspense support for progressive rendering"
]
```

## REMOVED_FROM_REACT18

### DEPRECATED_APIS
```javascript
[
  "propTypes",
  "defaultProps",
  "contextTypes",
  "getChildContext",
  "string refs",
  "React.createFactory",
  "module pattern factories",
  "React.forwardRef",
  "ReactDOM.render",
  "ReactDOM.hydrate",
  "ReactDOM.unmountComponentAtNode",
  "ReactDOM.findDOMNode",
  "react-test-renderer/shallow",
  "react-dom/test-utils",
  "react-test-renderer",
  "Context.Provider",
  "element.ref"
]
```

### REPLACEMENT_PATTERNS
```javascript
[
  {
    "old": "defaultProps",
    "new": "// Before - React 18\nfunction Component({name, age}) {\n  return <div>{name} is {age} years old</div>;\n}\nComponent.defaultProps = {\n  name: 'Anonymous',\n  age: 0\n};\n\n// After - React 19\nfunction Component({name = 'Anonymous', age = 0}) {\n  return <div>{name} is {age} years old</div>;\n}"
  },
  {
    "old": "React.forwardRef",
    "new": "// Before - React 18\nconst MyInput = React.forwardRef((props, ref) => (\n  <input {...props} ref={ref} />\n));\n\nfunction App() {\n  const inputRef = useRef(null);\n  return <MyInput ref={inputRef} placeholder=\"Enter text\" />;\n}\n\n// After - React 19\nfunction MyInput({placeholder, ref}) {\n  return <input placeholder={placeholder} ref={ref} />;\n}\n\nfunction App() {\n  const inputRef = useRef(null);\n  return <MyInput ref={inputRef} placeholder=\"Enter text\" />;\n}"
  },
  {
    "old": "ReactDOM.render",
    "new": "// Before - React 18\nimport {render} from 'react-dom';\nrender(<App />, document.getElementById('root'));\n\n// After - React 19\nimport {createRoot} from 'react-dom/client';\nconst root = createRoot(document.getElementById('root'));\nroot.render(<App />);"
  },
  {
    "old": "ReactDOM.hydrate",
    "new": "// Before - React 18\nimport {hydrate} from 'react-dom';\nhydrate(<App />, document.getElementById('root'));\n\n// After - React 19\nimport {hydrateRoot} from 'react-dom/client';\nhydrateRoot(document.getElementById('root'), <App />);"
  },
  {
    "old": "Context.Provider",
    "new": "// Before - React 18\nconst ThemeContext = createContext('');\nfunction App({children}) {\n  return (\n    <ThemeContext.Provider value=\"dark\">\n      {children}\n    </ThemeContext.Provider>\n  );\n}\n\n// After - React 19\nconst ThemeContext = createContext('');\nfunction App({children}) {\n  return (\n    <ThemeContext value=\"dark\">\n      {children}\n    </ThemeContext>\n  );\n}"
  }
]
```