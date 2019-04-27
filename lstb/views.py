from django.shortcuts import render

from django.http import HttpResponse
from django.http import HttpResponseBadRequest

import json
from . import lstHandler as lsth

def home(request):
    if request.method != 'POST':
        return render(request, 'lstb/index.html')

    if 'graphFile' in request.FILES:
        # upload the file
        f = request.FILES['graphFile']

        # run LST
        response_json = lsth.runLST(f)
    else:
        return HttpResponseBadRequest("Bad file upload")

    # return success message
    return HttpResponse(response_json, content_type="application/json")
