import unittest
from document_evidence_preprocessing import PreprocessingError,crop_surface,deskew_surface,resample_surface,compose_pipeline,roundtrip_error
from document_evidence_surface import make_surface

SOURCE="sha256:"+"a"*64

class PreprocessingTest(unittest.TestCase):
    def test_off_origin_crop_deskew_resample_roundtrip(self):
        source=make_surface(SOURCE,"rendered-raster",1000,800,"px","top-left","right","down",page_number=1)
        cropped,t1=crop_surface(source,137,89,700,500)
        deskewed,t2=deskew_surface(cropped,7.3,pad=True)
        resampled,t3=resample_surface(deskewed,1.37,1.11)
        pipeline=compose_pipeline([t1,t2,t3])
        points=[(137,89),(837,89),(837,589),(137,589),(487,339),(201,173),(744,511)]
        self.assertLessEqual(roundtrip_error(pipeline,points),1e-9)
        self.assertEqual(deskewed["metadata"]["appliedDegrees"],-7.3)
        self.assertNotEqual(deskewed["metadata"]["paddingTranslation"],[0.0,0.0])
        self.assertEqual(resampled["metadata"]["scaleX"],1.37)
    def test_invalid_crop_fails_closed(self):
        source=make_surface(SOURCE,"rendered-raster",100,80,"px","top-left","right","down",page_number=1)
        with self.assertRaises(PreprocessingError) as caught: crop_surface(source,90,70,20,20)
        self.assertEqual(caught.exception.code,"OCR_REGION_INVALID")
    def test_deskew_requires_pixel_surface(self):
        source=make_surface(SOURCE,"pdf-canonical-page",100,80,"pt","top-left","right","down",page_number=1)
        with self.assertRaises(PreprocessingError) as caught: deskew_surface(source,2.0)
        self.assertEqual(caught.exception.code,"OCR_DESKEW_PIXEL_SURFACE_REQUIRED")
    def test_pipeline_rejects_surface_discontinuity(self):
        source=make_surface(SOURCE,"rendered-raster",100,80,"px","top-left","right","down",page_number=1)
        cropped,t1=crop_surface(source,0,0,80,60)
        other=make_surface(SOURCE,"rendered-raster",50,50,"px","top-left","right","down",page_number=1)
        _,t2=resample_surface(other,2)
        with self.assertRaises(PreprocessingError) as caught: compose_pipeline([t1,t2])
        self.assertEqual(caught.exception.code,"PREPROCESSING_SURFACE_DISCONTINUITY")

if __name__=="__main__": unittest.main()
