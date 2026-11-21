from PIL import Image
ims=[Image.open(f'shots/look_{n}_{t}.png').resize((550,310)) for n in ['van','rv','bus'] for t in ['fl','rr']]
sheet=Image.new('RGB',(1100,930))
for i,im in enumerate(ims): sheet.paste(im,((i%2)*550,(i//2)*310))
sheet.save('shots/look_sheet.png')
