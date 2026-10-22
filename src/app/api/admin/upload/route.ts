import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase';
import { sameOrigin, failure, noStore } from '@/lib/http';
import { MAX_UPLOAD, detectMedia } from '@/lib/uploads';
import { z } from 'zod';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const db = await adminDb();
    if (Number(request.headers.get('content-length') || 0) > MAX_UPLOAD + 20000)
      return NextResponse.json(
        { error: 'Upload limit is 3 MB. Compress the file or use an HTTPS video URL.' },
        { status: 413 },
      );
    const form = await request.formData();
    const id = z.uuid().parse(form.get('product_id'));
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_UPLOAD)
      return NextResponse.json({ error: 'Choose a file under 3 MB.' }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const media = detectMedia(bytes);
    if (!media || media.mime !== file.type)
      return NextResponse.json(
        { error: 'Upload a valid JPEG, PNG, WebP, MP4, or WebM file.' },
        { status: 400 },
      );
    const { data: p } = await db.from('products').select('id').eq('id', id).single();
    if (!p)
      return NextResponse.json(
        { error: 'Save the product before uploading media.' },
        { status: 400 },
      );
    const key = `${id}/${crypto.randomUUID()}.${media.extension}`;
    const { error } = await db.storage
      .from('product-media')
      .upload(key, bytes, { contentType: media.mime, upsert: false });
    if (error) throw error;
    const {
      data: { publicUrl },
    } = db.storage.from('product-media').getPublicUrl(key);
    const { count } = await db
      .from('product_media')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);
    const { data: m, error: saveError } = await db
      .from('product_media')
      .insert({
        product_id: id,
        storage_key: key,
        url: publicUrl,
        type: media.type,
        position: count ?? 0,
        is_primary: false,
      })
      .select()
      .single();
    if (saveError) {
      await db.storage.from('product-media').remove([key]);
      throw saveError;
    }
    return NextResponse.json({ media: m }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
