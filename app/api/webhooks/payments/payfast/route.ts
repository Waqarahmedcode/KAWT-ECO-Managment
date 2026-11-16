// Explicitly disabled until KAWT obtains an approved merchant account and provider-specific
// request signing/verification documentation. Do not accept a fake 'success' query string.
export async function POST(){return Response.json({error:'PayFast is not enabled; implement and validate provider webhook signatures, transaction IDs, amount/currency before activation'},{status:501})}
