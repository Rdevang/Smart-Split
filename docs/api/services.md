# Services API Reference

> Last Updated: 2024-12-10

## Overview

Services encapsulate business logic and Supabase operations. They are located in `src/services/`.

---

## Profile Service

**File**: `src/services/profile.ts`

### Interface

```typescript
interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  currency: string;
}

interface UpdateProfileInput {
  full_name?: string;
  phone?: string | null;
  currency?: string;
  avatar_url?: string | null;
}
```

### Methods

#### `getProfile(userId: string)`

Fetches a user's profile from the database.

```typescript
const profile = await profileService.getProfile("user-123");
// Returns: ProfileData | null
```

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| userId | `string` | User's UUID |

**Returns**: `ProfileData | null`

---

#### `updateProfile(userId: string, input: UpdateProfileInput)`

Updates a user's profile.

```typescript
const result = await profileService.updateProfile("user-123", {
  full_name: "John Doe",
  phone: "+1234567890",
  currency: "EUR",
});
// Returns: { success: true } or { success: false, error: "..." }
```

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| userId | `string` | User's UUID |
| input | `UpdateProfileInput` | Fields to update |

**Returns**: `{ success: boolean; error?: string }`

---

#### `uploadAvatar(userId: string, file: File)`

Uploads a new avatar image.

```typescript
const result = await profileService.uploadAvatar("user-123", file);
// Returns: { url: "https://..." } or { url: null, error: "..." }
```

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| userId | `string` | User's UUID |
| file | `File` | Image file to upload |

**Validation**:
- Max size: 2MB
- Allowed types: image/jpeg, image/png, image/gif, image/webp

**Returns**: `{ url: string | null; error?: string }`

**Side Effects**:
- Deletes old avatar if exists
- Updates `profiles.avatar_url`
- Updates auth user metadata

---

#### `deleteAvatar(userId: string)`

Removes the user's avatar.

```typescript
const result = await profileService.deleteAvatar("user-123");
// Returns: { success: true } or { success: false, error: "..." }
```

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| userId | `string` | User's UUID |

**Returns**: `{ success: boolean; error?: string }`

**Side Effects**:
- Deletes file from storage
- Sets `profiles.avatar_url` to null
- Updates auth user metadata

---

## Usage Examples

### In a Server Component

```tsx
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  
  return <ProfileForm user={profile} />;
}
```

### In a Client Component

```tsx
"use client";

import { profileService } from "@/services/profile";

export function ProfileForm({ userId }) {
  const handleSubmit = async (data) => {
    const result = await profileService.updateProfile(userId, data);
    
    if (result.success) {
      // Show success message
    } else {
      // Show error: result.error
    }
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Avatar Upload

```tsx
"use client";

import { profileService } from "@/services/profile";

export function AvatarUpload({ userId }) {
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const result = await profileService.uploadAvatar(userId, file);
    
    if (result.url) {
      // Update UI with new avatar
    } else {
      // Show error: result.error
    }
  };
  
  return <input type="file" onChange={handleFileChange} />;
}
```

---

## Future Services

### Group Service (Planned)

```typescript
// src/services/group.ts
export const groupService = {
  async create(input: CreateGroupInput): Promise<Group>,
  async update(id: string, input: UpdateGroupInput): Promise<Result>,
  async delete(id: string): Promise<Result>,
  async addMember(groupId: string, userId: string): Promise<Result>,
  async removeMember(groupId: string, userId: string): Promise<Result>,
  async getBalances(groupId: string): Promise<Balance[]>,
};
```

### Expense Service (Planned)

```typescript
// src/services/expense.ts
export const expenseService = {
  async create(input: CreateExpenseInput): Promise<Expense>,
  async update(id: string, input: UpdateExpenseInput): Promise<Result>,
  async delete(id: string): Promise<Result>,
  async splitEqually(expenseId: string, members: string[]): Promise<Result>,
  async splitByAmount(expenseId: string, splits: Split[]): Promise<Result>,
  async splitByPercentage(expenseId: string, splits: Split[]): Promise<Result>,
};
```

### Settlement Service (Planned)

```typescript
// src/services/settlement.ts
export const settlementService = {
  async create(input: CreateSettlementInput): Promise<Settlement>,
  async getOptimizedSettlements(groupId: string): Promise<Settlement[]>,
};
```

---

## Error Handling

Services return structured responses:

```typescript
// Success
{ success: true }
{ url: "https://..." }
{ data: [...] }

// Error
{ success: false, error: "Error message" }
{ url: null, error: "Error message" }
{ data: null, error: "Error message" }
```

Always check for errors:

```typescript
const result = await profileService.updateProfile(id, data);

if (!result.success) {
  console.error(result.error);
  // Handle error
  return;
}

// Success path
```

