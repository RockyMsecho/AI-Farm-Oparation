# Registration returning a generic "Registration failed"

## What was happening

`RegisterDto` was the one DTO in the project without `= string.Empty;`
defaults on its string properties. Combined with `<Nullable>enable</Nullable>`
in `FarmManagement.API.csproj`, ASP.NET Core treats every non-nullable
`string` property as implicitly `[Required]`. If a request was missing one of
those fields - which is exactly what happened when the frontend stopped
sending a `role` field, since the fixed `Register` method doesn't need it -
the framework intercepted the request **before `AuthController.Register`'s
own code ever ran** and returned its own response shape:

```json
{ "errors": { "Role": ["The Role field is required."] } }
```

instead of this project's own:

```json
{ "message": "Please complete all required fields." }
```

The frontend only knew how to read `message`, so it fell back to a generic
"Registration failed" with no indication of which field, or why.

## The fix (two parts, both worth keeping)

1. **`RegisterDto`** now has `= string.Empty;` on every string property, like
   every other DTO in the project already did. Belt-and-braces - this alone
   doesn't stop the framework's implicit-required check, but it's the
   consistent pattern the rest of the codebase follows.

2. **`Program.cs`** now sets
   `options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true`
   on `AddControllers(options => ...)`. This is the actual fix - it stops
   ASP.NET Core from auto-inferring `[Required]` from nullable-reference-type
   annotations at all, on every DTO in the project, not just this one. Every
   controller here already does its own explicit validation and returns a
   friendly `{ message }` response; this setting lets that code run instead
   of being pre-empted by the framework.

Without change #2, the same class of bug can resurface on any future DTO the
moment a field is ever sent as `null` or omitted - it isn't specific to
`RegisterDto`, it's a property of the whole project's `<Nullable>enable</Nullable>` setting.
