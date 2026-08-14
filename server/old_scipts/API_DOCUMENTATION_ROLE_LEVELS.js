// API DOCUMENTATION: Role Level System Endpoints
// New endpoints added to /server/routes/roles.js

/**
 * ============================================================
 * ENDPOINT: GET /roles
 * ============================================================
 * Purpose: List all roles with permissions
 * Returns: Array of roles with assigned_count for each
 * 
 * Response:
 * [
 *   {
 *     id: 1,
 *     role_name: "Administrator",
 *     role_level: 100,
 *     is_system_default: true,
 *     is_custom: false,
 *     permissions: [...]
 *   }
 * ]
 */

/**
 * ============================================================
 * ENDPOINT: GET /roles/:id
 * ============================================================
 * Purpose: Get single role details including assigned count
 * Params: id (role ID)
 * 
 * Response:
 * {
 *   id: 5,
 *   role_name: "Coordinator",
 *   role_level: 75,
 *   description: "Academic Coordinator",
 *   is_system_default: false,
 *   is_custom: true,
 *   permissions: [
 *     { module_name: "attendance", can_read: true, can_write: true, can_delete: false },
 *     { module_name: "exams", can_read: true, can_write: true, can_delete: false }
 *   ],
 *   assigned_count: 3  ← Shows how many users have this role
 * }
 */

/**
 * ============================================================
 * ENDPOINT: GET /roles/:id/assigned-count
 * ============================================================
 * Purpose: Get count of users assigned to this role
 * Use: Before editing, show admin how many users will be affected
 * 
 * Params: id (role ID)
 * 
 * Response:
 * {
 *   assigned_count: 12
 * }
 * 
 * Example:
 * GET /roles/3/assigned-count
 * → { "assigned_count": 5 }
 */

/**
 * ============================================================
 * ENDPOINT: POST /roles
 * ============================================================
 * Purpose: Create new role with role_level and permissions
 * 
 * Request Body:
 * {
 *   role_name: "Principal",
 *   description: "School Principal",
 *   role_level: 95,
 *   permissions: [
 *     { module_name: "dashboard", can_read: true, can_write: true, can_delete: true },
 *     { module_name: "students", can_read: true, can_write: true, can_delete: true },
 *     { module_name: "attendance", can_read: true, can_write: true, can_delete: false }
 *   ]
 * }
 * 
 * Response:
 * {
 *   id: 7,
 *   role_name: "Principal",
 *   role_level: 95,
 *   is_custom: true,
 *   permissions: [...]
 * }
 */

/**
 * ============================================================
 * ENDPOINT: POST /roles/:id/clone
 * ============================================================
 * Purpose: Clone a role (create exact copy with permissions)
 * Use: When you want to change permissions for ONE user without
 *      affecting others who share the same role
 * 
 * Params: id (original role ID to clone)
 * 
 * Response:
 * {
 *   message: "Role cloned successfully",
 *   new_role_id: 8,
 *   new_role_name: "Teacher (copy)",
 *   new_role: {
 *     id: 8,
 *     role_name: "Teacher (copy)",
 *     role_level: 50,
 *     is_custom: true
 *   }
 * }
 * 
 * Example Flow:
 * 1. Admin sees: Teacher role has 15 assigned users
 * 2. Admin wants to give extra permission to Alice only
 * 3. Admin calls: POST /roles/4/clone
 * 4. Get back: new role "Teacher (copy)" with id=8
 * 5. Admin edits role 8, adds extra permission (e.g., fees.write)
 * 6. Admin assigns only Alice to role 8
 * 7. Result: Alice has extra permission, 15 other teachers unaffected ✓
 */

/**
 * ============================================================
 * ENDPOINT: PUT /roles/:id
 * ============================================================
 * Purpose: Update role details, level, and permissions
 * Safety: If role has assigned users, requires explicit ?apply_to_assigned=true
 * 
 * Request Body:
 * {
 *   role_name: "Coordinator",
 *   description: "Academic Coordinator (updated)",
 *   role_level: 75,
 *   permissions: [...]
 * }
 * 
 * Query Params:
 * ?apply_to_assigned=true   - Apply changes to all assigned users (required if users exist)
 * ?apply_to_assigned=false  - Will be rejected if role has assigned users (UI should clone instead)
 * 
 * Response (if no assigned users):
 * {
 *   message: "Role updated successfully",
 *   applied_to: "no users assigned"
 * }
 * 
 * Response (if assigned users and ?apply_to_assigned=true):
 * {
 *   message: "Role updated successfully",
 *   applied_to: "12 user(s)"
 * }
 * 
 * Response (if assigned users and ?apply_to_assigned is missing or false):
 * {
 *   error: "Role has assigned users",
 *   message: "This role is assigned to 12 user(s). Apply changes to all? Set ?apply_to_assigned=true",
 *   assigned_count: 12
 * }
 * 
 * ⚠️ SAFE EDITING FLOW:
 * 1. Admin clicks Edit on "Teacher" role (assigned to 10 users)
 * 2. UI shows: "Assigned to 10 users"
 * 3. Admin changes permission and clicks Save
 * 4. Frontend calls: PUT /roles/4?apply_to_assigned=false
 * 5. Backend returns error: "Role has assigned users"
 * 6. UI shows confirmation modal:
 *    "Apply changes to all 10 teachers?"
 *    [Apply to all] [Clone & edit] [Cancel]
 * 7. If admin chooses "Apply to all":
 *    → Frontend calls: PUT /roles/4?apply_to_assigned=true
 *    → Success: all 10 users affected
 * 8. If admin chooses "Clone & edit":
 *    → Frontend calls: POST /roles/4/clone
 *    → Get new role "Teacher (copy)"
 *    → Edit copy instead, affecting zero existing users
 */

/**
 * ============================================================
 * ENDPOINT: DELETE /roles/:id
 * ============================================================
 * Purpose: Delete a role (except system default roles)
 * 
 * Params: id (role ID)
 * 
 * Restrictions:
 * - Cannot delete system default roles (Administrator, Teacher, Accountant, Student)
 * - Can only delete custom roles created by users
 * 
 * Response:
 * {
 *   message: "Role deleted"
 * }
 * 
 * Error Response (if system role):
 * {
 *   error: "Cannot delete permanent system roles"
 * }
 */

/**
 * ============================================================
 * ROLE LEVEL HIERARCHY (Standard)
 * ============================================================
 * 
 * 100 = Administrator       - Full system access
 * 95  = Principal           - All features (except system settings)
 * 90  = Vice Principal      - Teaching + basic admin features
 * 75  = Coordinator         - Teaching + limited admin features
 * 65  = Head Teacher        - Teaching features only (can manage own level)
 * 50  = Teacher             - Own classes only
 * 30  = Accountant          - Finance features only
 * 20  = Assistant           - Support staff (limited)
 * 10  = Student             - Own data only
 * 
 * When creating custom roles, pick appropriate level based on intended access.
 * Higher level = more system-wide access.
 * Lower level = more restricted to own assignments.
 */

/**
 * ============================================================
 * TYPICAL ADMIN WORKFLOWS
 * ============================================================
 * 
 * WORKFLOW 1: Create new custom role
 * GET /roles                          // see existing roles
 * POST /roles                         // create new with name, level, perms
 * Result: New role available to assign to users
 * 
 * WORKFLOW 2: Give extra permission to ONE user
 * 1. GET /roles/4/assigned-count      // check impact
 * 2. POST /roles/4/clone              // create safe copy
 * 3. PUT /roles/8 (the copy)          // add extra permission
 * 4. (Via user edit) Assign role 8 to that user
 * Result: One user affected, others safe
 * 
 * WORKFLOW 3: Update permission for ALL users of a role
 * 1. GET /roles/4/assigned-count      // inform admin
 * 2. PUT /roles/4?apply_to_assigned=true  // update all
 * Result: All users of that role get new permission
 */

module.exports = {
    // This file is documentation only
    // See server/routes/roles.js for actual implementation
};
