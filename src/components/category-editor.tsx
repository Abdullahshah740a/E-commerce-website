'use client';
import { useState } from 'react';
import { adminAction } from './admin-common';
import type { Category } from '@/lib/types';
export function CategoryEditor({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [key, setKey] = useState(0);
  return (
    <>
      <h1 className="page-title">Categories.</h1>
      <p>
        Renaming a category preserves product links. Deactivating hides its products from shoppers.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Order</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.name}
                  <small>{c.slug}</small>
                </td>
                <td>{c.position}</td>
                <td>{c.active ? 'Active' : 'Inactive'}</td>
                <td>
                  <button
                    className="text-link"
                    onClick={() => {
                      setEditing(c);
                      setKey((k) => k + 1);
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>{editing ? 'Edit category' : 'Add category'}</h2>
      <form
        key={key}
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          if (
            editing?.active &&
            f.active !== 'on' &&
            !confirm('Deactivate this category and hide its products?')
          )
            return;
          setBusy(true);
          setMessage('');
          try {
            await adminAction('category', {
              id: editing?.id,
              name: f.name,
              slug: f.slug,
              description: f.description,
              image_url: f.image_url || null,
              position: Number(f.position),
              active: f.active === 'on',
            });
            window.location.reload();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : 'Unable to save category.');
          }
          setBusy(false);
        }}
      >
        <label>
          Name
          <input name="name" required defaultValue={editing?.name} />
        </label>
        <label>
          URL slug
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={editing?.slug}
          />
        </label>
        <label>
          Display order
          <input
            type="number"
            name="position"
            min="0"
            required
            defaultValue={editing?.position ?? 0}
          />
        </label>
        <label>
          Image URL (optional)
          <input type="url" name="image_url" defaultValue={editing?.image_url || ''} />
        </label>
        <label className="wide">
          Description
          <textarea name="description" defaultValue={editing?.description} />
        </label>
        <label className="check-label">
          <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} />
          Active category
        </label>
        <div className="row wide">
          <button className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Save category'}
          </button>
          {editing && (
            <button
              className="text-link"
              type="button"
              onClick={() => {
                setEditing(null);
                setKey((k) => k + 1);
              }}
            >
              Cancel editing
            </button>
          )}
        </div>
      </form>
      {message && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
    </>
  );
}
